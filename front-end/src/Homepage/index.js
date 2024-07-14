import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Col, Row, Container, Card } from "react-bootstrap";
import { useUser } from "../UserProvider";
import { useInterval } from "../util/useInterval";
import validateToken from "../util/tokenValidator";
import ajax from "../Services/fetchService";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

const Homepage = () => {
  const user = useUser();
  const navigate = useNavigate();
  const userRef = useRef(user);
  const navigateRef = useRef(navigate);
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    userRef.current = user;
    navigateRef.current = navigate;
  }, [user, navigate]);

  useEffect(() => {
    const checkTokenAndFetchData = async () => {

      if (!userRef.current.jwt) {
        navigateRef.current("/login");
        return;
      }

      const isValid = await validateToken(userRef.current.jwt);
      if (!isValid) {
        userRef.current.setJwt(null);
        navigateRef.current("/login");
      }
    };

    checkTokenAndFetchData();
  }, [userRef, navigateRef]);

  useInterval(async () => {

    if (!userRef.current.jwt) {
      navigateRef.current("/login");
      return;
    }

    const isValid = await validateToken(userRef.current.jwt);
    if (!isValid) {
      userRef.current.setJwt(null);
      navigateRef.current("/login");
    }
  }, 60000);

  useEffect(() => {

    if (!user.jwt) {
      navigate("/login");
      return;
    }

    const socket = new SockJS("/ws");
    const client = Stomp.over(socket);

    client.debug = () => {};

    client.connect(
      {
        Authorization: `Bearer ${user.jwt}`,
      },
      () => {
        ajax("/api/listDocuments", "GET", user.jwt)
          .then((data) => setFileList(data))
          .catch((error) =>
            console.error("Error fetching document list:", error)
          );

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

        client.subscribe("/topic/deleteDocument", (message) => {
          const deletedDocument = JSON.parse(message.body);
          setFileList((prevFileList) =>
            prevFileList.filter((file) => file.id !== deletedDocument.id)
          );
        
          if (window.location.pathname === `/edit/${deletedDocument.id}`) {
            navigateRef.current("/");
          }
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
  }, [user.jwt, navigate]);

  const handleCardClick = (e, fileId) => {
    if (!e.target.closest(".delete-btn")) {
      navigate(`/edit/${fileId}`);
    }
  };

  async function getUserInfo(jwt) {
    const response = await fetch("/api/userInfo", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      throw new Error("Ошибка получения информации о пользователе");
    }

    return response.json();
  }

  const handleDeleteFile = async (fileId) => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите удалить этот файл?"
    );
    if (confirmDelete) {
      try {
        await ajax(`/api/deleteDocument/${fileId}`, "DELETE", user.jwt).then(
          () => {
            setFileList((prevFileList) =>
              prevFileList.filter((file) => file.id !== fileId)
            );
          }
        );
      } catch (error) {
        console.error("Ошибка при удалении файла:", error);
        alert("Ошибка при удалении файла");
      }
    }
  };

  const handleAddNewFile = async () => {
    const newFileName = prompt("Введите имя нового файла:");
    if (newFileName) {
      try {
        const userInfo = await getUserInfo(user.jwt);
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

  return (
    <Container>
      <Row className="mt-1">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <Button variant="primary" onClick={handleAddNewFile}>
              Добавить новый файл
            </Button>
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() => {
                userRef.current.setJwt(null);
                navigateRef.current("/login");
              }}
            >
              Выйти
            </Button>
          </div>
        </Col>
      </Row>

      <Row className="mt-2">
        <Col>
          <div className="h1 d-flex justify-content-center align-items-center">
            Доступные файлы
          </div>
        </Col>
      </Row>
      <Row className="mt-4 report-wrapper report">
        <Col>
          {fileList && fileList.length > 0 ? (
            <div>
              {fileList.map((file) => (
                <Card
                  key={file.id}
                  style={{
                    width: "100%",
                    border: "2px solid #000000",
                    marginBottom: "1rem",
                    transition:
                      "box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out, background-color 0.3s ease-in-out",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px 0 rgba(0, 0, 0, 0.2)";
                    e.currentTarget.style.transform = "scale(1.02)";
                    e.currentTarget.style.backgroundColor = "#DCDCDC";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.backgroundColor = "#fff";
                  }}
                  onClick={(e) => handleCardClick(e, file.id)}
                >
                  <Card.Body className="d-flex flex-column justify-content-around">
                    <Card.Title
                      className="text-center"
                      style={{
                        fontWeight: "bolder",
                        fontSize: "2rem",
                        textDecoration: "none",
                      }}
                    >
                      {file.name}
                    </Card.Title>
                    <Card.Text className="text-center">
                      Создатель:{" "}
                      {file.creator ? file.creator.username : "Неизвестно"}
                    </Card.Text>
                    <Button
                      variant="danger"
                      className="delete-btn mt-2"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      Удалить
                    </Button>
                  </Card.Body>
                </Card>
              ))}
            </div>
          ) : (
            <div></div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default Homepage;
