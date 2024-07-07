import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

function Homepage() {
  const [fileList, setFileList] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    const client = Stomp.over(socket);

    client.debug = () => {};

    client.connect(
      {},
      () => {
        fetch("/api/listDocuments")
          .then((response) => response.json())
          .then((data) => setFileList(data))
          .catch((error) => console.error("Error fetching document list:", error));

        client.subscribe("/topic/renameDocument", (message) => {
          const data = JSON.parse(message.body);
          setFileList(
            fileList.map((file) =>
              file.id === data.id ? { ...file, name: data.newName } : file
            )
          );
        });

        client.subscribe("/topic/newDocument", (message) => {
          const newFile = JSON.parse(message.body);
          setFileList([...fileList, newFile]);
        });
      },
      (error) => {
        console.error("Connection error:", error);
      }
    );

    return () => {
      if (client) {
        try {
          client.disconnect();
        } catch (error) {
          console.error("Disconnection error:", error);
        }
      }
    };
  }, [fileList]);

  const handleCardClick = (fileId) => {
    navigate(`/edit/${fileId}`);
  };

  const handleAddNewFile = () => {
    const newFileName = prompt("Введите имя нового файла:");
    if (newFileName) {
      fetch(`/api/newDocument/${newFileName}`, {
        method: "POST",
      })
        .then((response) => {
          if (!response.ok) {
            alert("Ошибка при создании нового файла");
          } else {
            response.json().then((newFile) => {
              setFileList([...fileList, newFile]);
              navigate(`/edit/${newFile.id}`);
            });
          }
        })
        .catch((error) => {
          console.error("Error creating new document:", error);
        });
    }
  };

  return (
    <div className="homepage-container">
      <button className="add-file-button" onClick={handleAddNewFile}>
        Добавить новый файл
      </button>
      <div className="document-list">
        {fileList.map((file) => (
          <div
            key={file.id}
            className="document-card"
            onClick={() => handleCardClick(file.id)}
          >
            <span style={{ fontSize: "20px" }}>{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Homepage;