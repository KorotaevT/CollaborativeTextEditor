import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import ReconnectingWebSocket from 'reconnecting-websocket';
import { useInterval } from "../util/useInterval";
import { useUser } from "../UserProvider";
import validateToken from "../util/tokenValidator";
import ajax from "../Services/fetchService";

function DocumentEdit() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const userRef = useRef(user);
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("3");
  const [isConnected, setIsConnected] = useState(false);
  const [fileExists, setFileExists] = useState(false);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [fileList, setFileList] = useState([]);
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
    navigateRef.current = navigate;
  }, [user, navigate]);

  useEffect(() => {
    const checkTokenAndFetchData = async () => {
      const isValid = await validateToken(userRef.current.jwt);
      if (!isValid) {
        userRef.current.setJwt(null);
        navigateRef.current("/login");
      }
    };

    checkTokenAndFetchData();
  }, [userRef, navigateRef]);

  useInterval(async () => {
    const isValid = await validateToken(userRef.current.jwt);
    if (!isValid) {
      userRef.current.setJwt(null);
      navigateRef.current("/login");
    }
  }, 60000);

  useEffect(() => {
    const socket = new SockJS("/ws");
    const client = Stomp.over(() => socket);
    
    client.reconnect_delay = 60000;
    
    client.connect(
        {
            Authorization: `Bearer ${user.jwt}`,
        },
        () => {
            setIsConnected(true);
            setStompClient(client);

            ajax("/api/listDocuments", "GET", user.jwt)
                .then((data) => setFileList(data))
                .catch((error) => console.error("Error fetching document list:", error));

            client.subscribe(`/topic/updates/${id}`, (message) => {
                if (message.body) {
                    const newContent = JSON.parse(message.body).content;
                    if (editorRef.current.innerHTML !== newContent) {
                        setContent(newContent);
                    }
                }
            });

            client.subscribe("/topic/renameDocument", (message) => {
                const data = JSON.parse(message.body);
                setFileList((prevFileList) =>
                    prevFileList.map((file) =>
                        file.id === data.id ? { ...file, name: data.newName } : file
                    )
                );
            });

            client.subscribe("/topic/newDocument", (message) => {
                const newFile = JSON.parse(message.body);
                setFileList((prevFileList) => [...prevFileList, newFile]);
            });

            if (id) {
                ajax(`/api/getDocument/${id}`, "GET", user.jwt)
                    .then((data) => {
                        setContent(data.content);
                        setFileName(data.name);
                        setFileExists(true);
                    })
                    .catch((error) => {
                        console.error(error);
                        setFileExists(false);
                    });
            } else {
                setFileExists(false);
            }
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
}, [id, user.jwt]);

  useEffect(() => {
    const file = fileList.find((file) => file.id === id);
    if (file) {
      setFileName(file.name);
    }
  }, [fileList, id]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML === "") {
      document.execCommand("fontSize", false, fontSize);
    }
  }, [fontSize]);

  useEffect(() => {
    ajax("/api/listDocuments", "GET", user.jwt)
      .then((data) => setFileList(data))
      .catch((error) => console.error("Error fetching document list:", error));
  }, [user.jwt]);

  const sendUpdate = (updateContent) => {
    const update = {
      id,
      name: fileName,
      content: updateContent,
      creatorUsername: "123",
    };
  
    if (stompClient && stompClient.connected) {
      try {
        stompClient.send(
          "/app/updateDocument/" + id,
          {},
          JSON.stringify(update)
        );
      } catch (error) {
        console.error("Send update error:", error);
      }
    }
  };
  
  const handleInput = () => {
    saveSelection();
    const newContent = editorRef.current.innerHTML;

    if (!newContent) {
      document.execCommand("fontSize", false, fontSize);
    }

    setContent(newContent);

    setTimeout(() => {
      restoreSelection();
      sendUpdate(newContent);
    }, 0);
  };

  const applyFormat = (command, value = null) => {
    saveSelection();
    document.execCommand(command, false, value);
    restoreSelection();
    handleInput();
  };

  const handleFontSizeChange = (event) => {
    const newSize = event.target.value;
    setFontSize(newSize);
    saveSelection();
    document.execCommand("fontSize", false, newSize);
    restoreSelection();
  };

  const handleMouseDown = () => saveSelection();

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;

        if (startContainer.nodeType === Node.TEXT_NODE) {
          if (startOffset === startContainer.length) {
            const newElement = document.createElement("div");
            newElement.appendChild(document.createElement("br"));
            range.insertNode(newElement);
            range.setStartAfter(newElement);
          } else {
            const textNode = startContainer.splitText(startOffset);
            const newElement = document.createElement("div");
            newElement.appendChild(textNode);
            range.insertNode(newElement);
            range.setStartAfter(newElement);
          }
        } else {
          const newElement = document.createElement("div");
          newElement.appendChild(document.createElement("br"));
          range.insertNode(newElement);
          range.setStartAfter(newElement);
        }

        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand("fontSize", false, fontSize);
      }
    } else {
      if (fontSize) {
        document.execCommand("fontSize", false, fontSize);
      }
    }
  };

  const saveSelection = () => {
    if (window.getSelection && editorRef.current) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(editorRef.current);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const start = preSelectionRange.toString().length;
        savedRangeRef.current = { start, end: start + range.toString().length };
      }
    }
  };

  const restoreSelection = () => {
    if (savedRangeRef.current && editorRef.current) {
      const range = document.createRange();
      const selection = window.getSelection();
      const charIndex = { start: 0, end: 0 };
      const nodeStack = [editorRef.current];
      let node,
        foundStart = false,
        stop = false;

      while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === 3) {
          const nodeLength = node.nodeValue.length;
          if (
            !foundStart &&
            savedRangeRef.current.start >= charIndex.start &&
            savedRangeRef.current.start <= charIndex.start + nodeLength
          ) {
            range.setStart(node, savedRangeRef.current.start - charIndex.start);
            foundStart = true;
          }
          if (
            foundStart &&
            savedRangeRef.current.end >= charIndex.start &&
            savedRangeRef.current.end <= charIndex.start + nodeLength
          ) {
            range.setEnd(node, savedRangeRef.current.end - charIndex.start);
            stop = true;
          }
          charIndex.start += nodeLength;
        } else {
          let i = node.childNodes.length;
          while (i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handleFileAction = (action) => {
    switch (action) {
      case "rename":
        const newName = prompt("Введите новое имя файла:");
        if (newName) {
          ajax("/api/renameDocument", "POST", user.jwt, { id, newName })
            .then((response) => {
              if (!response.ok) {
                alert("Ошибка при переименовании файла");
              } else {
                console.log("Файл успешно переименован");
                stompClient.send(
                  "/app/renameDocument",
                  {},
                  JSON.stringify({
                    id,
                    oldName: fileName,
                    newName,
                  })
                );
                console.log("Имя файла " + newName);
                setFileName(newName);
              }
            })
            .catch((error) => console.error(error));
        }
        break;
      case "new":
        handleAddNewFile();
        break;

      case "downloadTxt":
        const plainText = editorRef.current.innerText;
        const element = document.createElement("a");
        const file = new Blob([plainText], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = `${fileName}.txt`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        break;
      default:
        break;
    }
  };

  const handleAddNewFile = async () => {
    const newFileName = prompt("Введите имя нового файла:");
    if (newFileName) {
      try {
        const userInfo = await ajax("/api/userInfo", "GET", user.jwt);
        const creatorId = userInfo.id;
        ajax("/api/newDocument", "POST", user.jwt, {
          name: newFileName,
          creatorId,
        })
          .then((newFile) => {
            setFileList((prevFileList) => [...prevFileList, newFile]);
            navigate(`/edit/${newFile.id}`);
          })
          .catch((error) => {
            console.error("Error creating new document:", error);
            alert("Ошибка при создании нового файла");
          });
      } catch (error) {
        console.error("Ошибка получения информации о пользователе:", error);
        alert("Не удалось получить информацию о пользователе");
      }
    }
  };

  const fontSizes = [
    { value: "1", label: "8pt" },
    { value: "2", label: "10pt" },
    { value: "3", label: "12pt" },
    { value: "4", label: "14pt" },
    { value: "5", label: "18pt" },
    { value: "6", label: "24pt" },
    { value: "7", label: "36pt" },
    { value: "8", label: "48pt" },
    { value: "9", label: "72pt" },
  ];

  const handleClearDocument = () => {
    setContent("");
    sendUpdate("");
  };

  return (
    <div className="App">
      <div className="header">
        <button className="header-button">
          Файл
          <div className="dropdown-menu">
            <button onClick={() => handleFileAction("rename")}>
              Переименовать
            </button>
            <button onClick={() => handleFileAction("new")}>Новый файл</button>
            <button onClick={() => handleFileAction("downloadTxt")}>
              Скачать .txt
            </button>
          </div>
        </button>
        <div className="filename">{fileName}</div>
        <button
          className="header-button"
          onClick={() => {
            navigateRef.current("/");
          }}
        >
          Назад
        </button>
      </div>
      {fileExists ? (
        <div className="editor-container">
          <div className="toolbar">
            <button
              className="toolbar-button"
              onClick={() => applyFormat("bold")}
            >
              Bold
            </button>
            <button
              className="toolbar-button"
              onClick={() => applyFormat("italic")}
            >
              Italic
            </button>
            <button
              className="toolbar-button"
              onClick={() => applyFormat("underline")}
            >
              Underline
            </button>
            <button className="toolbar-button" onClick={handleClearDocument}>
              Очистить всё
            </button>
            <select
              value={fontSize}
              onChange={handleFontSizeChange}
              onMouseDown={handleMouseDown}
            >
              {fontSizes.map((size) => (
                <option
                  key={size.value}
                  value={size.value}
                  onMouseEnter={() => setFontSize(size.value)}
                >
                  {size.label}
                </option>
              ))}
            </select>
          </div>

          <div
            className="editor"
            contentEditable
            ref={editorRef}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            dangerouslySetInnerHTML={{ __html: content }}
          ></div>
        </div>
      ) : (
        <div className="no-file">
          {id ? "Файл не найден" : "Выберите или создайте новый файл"}
        </div>
      )}
    </div>
  );
}

export default DocumentEdit;
