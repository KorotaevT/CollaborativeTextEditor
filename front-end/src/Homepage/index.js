import React, { useEffect, useState, useRef } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

function App() {
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("3");
  const [fileExists, setFileExists] = useState(false);
  const [content, setContent] = useState("");
  const [showFileSwitch, setShowFileSwitch] = useState(false);
  const [currentFileName, setCurrentFileName] = useState(
    localStorage.getItem("currentFileName") || ""
  );
  const [fileList, setFileList] = useState([]);
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    const client = Stomp.over(socket);

    client.connect(
      {},
      () => {
        client.subscribe(
          "/topic/updates",
          (message) => {
            if (message.body) {
              const newContent = JSON.parse(message.body).content;
              setContent(newContent);
            }
          },
          (error) => {
            if (!error.message.includes("ERR_STREAM_WRITE_AFTER_END")) {
              console.error(error);
            }
          }
        );

        if (currentFileName) {
          fetch(`/api/getDocument/${currentFileName}`)
            .then((response) => {
              if (!response.ok) {
                throw new Error("Файл не найден");
              }
              return response.json();
            })
            .then((data) => {
              const newContent = data.content;
              setContent(newContent);
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

    setStompClient(client);

    return () => {
      if (client) {
        try {
          client.disconnect();
        } catch (error) {
          console.error("Disconnection error:", error);
        }
      }
    };
  }, [currentFileName]);

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
    if (stompClient && stompClient.connected) {
      const update = { fileName: currentFileName, content: updateContent };
      try {
        console.log(currentFileName);
        console.log(update);
        stompClient.send("/app/updateDocument", {}, JSON.stringify(update));
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

    const selection = window.getSelection();

    setContent(newContent);

    setTimeout(() => {
      restoreSelection(selection);
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
        const newName = prompt("Введите новое имя файла:", currentFileName);
        if (newName) {
          fetch("/api/renameDocument", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ oldName: currentFileName, newName }),
          }).then((response) => {
            if (!response.ok) {
              alert("Ошибка при переименовании файла");
            } else {
              setCurrentFileName(newName);
              localStorage.setItem("currentFileName", newName);
              setFileList(
                fileList.map((name) =>
                  name === currentFileName ? newName : name
                )
              );
            }
          });
        }
        break;
      case "new":
        const newFileName = prompt("Введите новое имя файла:");
        if (newFileName) {
          fetch(`/api/newDocument/${newFileName}`, {
            method: "POST",
          })
            .then((response) => {
              if (!response.ok) {
                alert("Ошибка при создании нового файла");
              } else {
                setCurrentFileName(newFileName);
                localStorage.setItem("currentFileName", newFileName);
                setFileList([...fileList, newFileName]);
              }
            })
            .catch((error) => {
              console.error("Error creating new document:", error);
            });
        }
        break;
      case "downloadTxt":
        window.open("/api/downloadTxt", "_blank");
        break;
      default:
        break;
    }
  };

  const handleFileSwitch = (event) => {
    const selectedFile = event.target.value;
    if (selectedFile !== currentFileName) {
      setCurrentFileName(selectedFile);
      localStorage.setItem("currentFileName", selectedFile);

      fetch(`/api/getDocument/${selectedFile}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Файл не найден");
          }
          return response.json();
        })
        .then((data) => {
          const newContent = data.content;
          setContent(newContent);
          setFileExists(true);
        })
        .catch((error) => {
          console.error(error);
          setFileExists(false);
        });
    }
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
            <div className="switch-container">
              <button
                onMouseEnter={() => setShowFileSwitch(true)}
                onMouseLeave={() => setShowFileSwitch(false)}
              >
                Переключиться на другой файл
              </button>
              {showFileSwitch && (
                <select
                  onChange={handleFileSwitch}
                  className="file-switch"
                  onMouseEnter={() => setShowFileSwitch(true)}
                  onMouseLeave={() => setShowFileSwitch(false)}
                >
                  {fileList.map((file) => (
                    <option
                      key={file}
                      value={file}
                      selected={file === currentFileName}
                    >
                      {file}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </button>
        <div className="filename">{currentFileName}</div>
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
            <select
              value={fontSize}
              onChange={handleFontSizeChange}
              onMouseDown={handleMouseDown}
            >
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3">12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">36pt</option>
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
          {currentFileName
            ? "Файл не найден"
            : "Выберите или создайте новый файл"}
        </div>
      )}
    </div>
  );
}

export default App;