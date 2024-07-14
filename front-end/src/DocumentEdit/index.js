import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import { useInterval } from "../util/useInterval";
import { useUser } from "../UserProvider";
import validateToken from "../util/tokenValidator";
import ajax from "../Services/fetchService";
import "bootstrap/dist/css/bootstrap.min.css";
import { Dropdown, Button } from "react-bootstrap";

function DocumentEdit() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const userRef = useRef(user);
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("3");
  const [activeUsers, setActiveUsers] = useState([]);
  const [fileExists, setFileExists] = useState(false);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [fileList, setFileList] = useState([]);
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [fontFamily, setFontFamily] = useState("Times New Roman");
  const handleFontFamilyChange = (event) => {
    const newFontFamily = event.target.value;
    setFontFamily(newFontFamily);
    document.execCommand("fontName", false, newFontFamily);
  };

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
      async () => {
        setStompClient(client);

        try {
          const userInfo = await ajax("/api/userInfo", "GET", user.jwt);

          if (id) {
            ajax(`/api/getDocument/${id}`, "GET", user.jwt)
              .then((data) => {
                setContent(data.content);
                setFileName(data.name);
                setFileExists(true);
                console.log("Sending connect message");
                client.send(
                  `/app/activeUsers/${id}`,
                  {},
                  JSON.stringify({
                    documentId: parseInt(id),
                    userId: userInfo.id,
                    action: "connect",
                  })
                );
              })
              .catch((error) => {
                console.error(error);
                setFileExists(false);
              });
          } else {
            setFileExists(false);
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
        }

        ajax("/api/listDocuments", "GET", user.jwt)
          .then((data) => setFileList(data))
          .catch((error) =>
            console.error("Error fetching document list:", error)
          );

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
          setFileName(data.newName);
        });

        client.subscribe("/topic/newDocument", (message) => {
          const newFile = JSON.parse(message.body);
          setFileList((prevFileList) => [...prevFileList, newFile]);
        });

        client.subscribe("/topic/deleteDocument", (message) => {
          const deletedDocument = JSON.parse(message.body);
          if (deletedDocument.id == id) {
            alert("Этот файл был удален.");
            navigateRef.current("/");
          }
        });

        client.subscribe(`/topic/activeUsers/${id}`, (message) => {
          const activeUsers = JSON.parse(message.body);
          setActiveUsers(activeUsers);
          console.log(activeUsers);
        });
      },
      (error) => {
        console.error("Connection error:", error);
      }
    );

    return () => {
      if (client) {
        (async () => {
          try {
            const userInfo = await ajax("/api/userInfo", "GET", user.jwt);
            console.log("Sending disconnect message");
            client.send(
              `/app/activeUsers/${id}`,
              {},
              JSON.stringify({
                documentId: parseInt(id),
                userId: userInfo.id,
                action: "disconnect",
              })
            );
            client.disconnect();
          } catch (error) {
            console.error("Disconnection error:", error);
          }
        })();
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
      creatorUsername: "creator",
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
            .then((data) => {
              console.log(data);
              if (!data) {
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

  const handleDeleteFile = async () => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите удалить этот файл?"
    );
    if (confirmDelete) {
      try {
        await ajax(`/api/deleteDocument/${id}`, "DELETE", user.jwt).then(() => {
          if (fileList.find((file) => file.id === id)) {
            stompClient.send("/app/deleteDocument", {}, JSON.stringify({ id }));
          }
        });
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

  const handleClearDocument = () => {
    if (window.confirm("Вы уверены, что хотите очистить всё?")) {
      setContent("");
      sendUpdate("");
    }
  };

  return (
    <div className="App container">
      <div className="header row">
        <div className="col d-flex justify-content-between align-items-center">
          <Dropdown>
            <Dropdown.Toggle variant="primary" id="fileDropdown">
              Файл
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => handleFileAction("rename")}>
                Переименовать
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleFileAction("new")}>
                Новый файл
              </Dropdown.Item>
              <Dropdown.Item onClick={() => handleFileAction("downloadTxt")}>
                Скачать .txt
              </Dropdown.Item>
              <Dropdown.Item onClick={handleDeleteFile}>
                Удалить файл
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <div className="filename mx-2">Документ: {fileName}</div>
          <Dropdown>
            <Dropdown.Toggle variant="primary" id="activeUsersDropdown">
              Активные пользователи: {activeUsers.length}
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ minWidth: "fit-content" }}>
              {activeUsers.length > 0 ? (
                activeUsers.map((user, index) => (
                  <Dropdown.Item
                    key={index}
                    style={{
                      width: "250px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {user}
                  </Dropdown.Item>
                ))
              ) : (
                <Dropdown.Item
                  disabled
                  style={{
                    width: "250px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Нет активных пользователей
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown>

          <Button
            variant="primary"
            className="header-button mx-2"
            onClick={() => navigate("/")}
          >
            Назад
          </Button>
        </div>
      </div>
      {fileExists ? (
        <div className="row justify-content-center">
          <div className="col-8 editor-container">
            <div className="toolbar mb-2">
              <Button
                className="toolbar-button"
                onClick={() => applyFormat("bold")}
              >
                Bold
              </Button>
              <Button
                className="toolbar-button"
                onClick={() => applyFormat("italic")}
              >
                Italic
              </Button>
              <Button
                className="toolbar-button"
                onClick={() => applyFormat("underline")}
              >
                Underline
              </Button>
              <Button className="toolbar-button" onClick={handleClearDocument}>
                Очистить всё
              </Button>
              <select
                className="form-control d-inline-block w-auto"
                value={fontFamily}
                onChange={handleFontFamilyChange}
              >
                <option value="Colibri">Colibri</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
              <select
                className="form-control d-inline-block w-auto"
                value={fontSize}
                onChange={handleFontSizeChange}
              >
                <option value="1">8pt</option>
                <option value="2">10pt</option>
                <option value="3">12pt</option>
                <option value="4">14pt</option>
                <option value="5">18pt</option>
                <option value="6">24pt</option>
                <option value="7">36pt</option>
                <option value="8">48pt</option>
                <option value="9">72pt</option>
              </select>
            </div>

            <div
              className="editor form-control mb-2"
              contentEditable
              ref={editorRef}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              style={{ fontFamily }}
              dangerouslySetInnerHTML={{ __html: content }}
            ></div>
          </div>
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
