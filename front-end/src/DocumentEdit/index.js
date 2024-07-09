import React, { useEffect, useState, useRef } from "react";
import SockJS from "sockjs-client";
import { useParams, useNavigate } from "react-router-dom";
import { Stomp } from "@stomp/stompjs";

function DocumentEdit() {
  const { id } = useParams();
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("3");
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const [fileExists, setFileExists] = useState(false);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [fileList, setFileList] = useState([]);
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const socket = new SockJS("/ws");
    const client = Stomp.over(() => socket);

    client.debug = () => {};

    client.connect(
      {},
      () => {
        setIsConnected(true);
        setStompClient(client);

        fetch("/api/listDocuments")
          .then((response) => response.json())
          .then((data) => setFileList(data))
          .catch((error) =>
            console.error("Error fetching document list:", error)
          );

        client.subscribe(
          `/topic/updates/${id}`,
          (message) => {
            if (message.body) {
              const newContent = JSON.parse(message.body).content;
              if (editorRef.current.innerHTML !== newContent) {
                setContent(newContent);
              }
            }
          },
          (error) => {
            if (!error.message.includes("ERR_STREAM_WRITE_AFTER_END")) {
              console.error(error);
            }
          }
        );

        client.subscribe("/topic/renameDocument", (message) => {
          const data = JSON.parse(message.body);
          setFileList((fileList) =>
            fileList.map((file) =>
              file.id === data.id ? { ...file, name: data.newName } : file
            )
          );
        });

        client.subscribe("/topic/newDocument", (message) => {
          const newFile = JSON.parse(message.body);
          setFileList((prevFileList) => [...prevFileList, newFile]);
        });

        if (id) {
          fetch(`/api/getDocument/${id}`)
            .then((response) => {
              if (!response.ok) {
                throw new Error("Файл не найден");
              }
              return response.json();
            })
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
  }, [id]);

  useEffect(() => {
    if (id && fileList.length > 0) {
      const file = fileList.find((file) => file.id === id);
      if (file) {
        setFileName(file.name);
      }
    }
  }, [id, fileList]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML === "") {
      document.execCommand("fontSize", false, fontSize);
    }
  }, [fontSize]);

  useEffect(() => {
    fetch("/api/listDocuments")
      .then((response) => response.json())
      .then((data) => setFileList(data))
      .catch((error) => console.error("Error fetching document list:", error));
  }, []);

  const sendUpdate = (updateContent) => {
    if (stompClient && isConnected) {
      const update = { id, name: fileName, content: updateContent };
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
          fetch("/api/renameDocument", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id, newName }),
          })
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
