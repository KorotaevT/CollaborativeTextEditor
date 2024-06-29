import React, { useEffect, useState, useRef } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

function App() {
  const [content, setContent] = useState("");
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("3");
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const socket = new SockJS("/ws");
    const client = Stomp.over(socket);

    client.connect({}, () => {
      client.subscribe("/topic/updates", (message) => {
        if (message.body) {
          const newContent = JSON.parse(message.body).content;
          setContent(newContent);
          if (editorRef.current) {
            editorRef.current.innerHTML = newContent;
            restoreSelection();
          }
        }
      }, (error) => {
        if (!error.message.includes('ERR_STREAM_WRITE_AFTER_END')) {
          console.error(error);
        }
      });
    });

    setStompClient(client);

    fetch("/api/getDocument")
      .then((response) => response.json())
      .then((data) => {
        const newContent = data.content;
        setContent(newContent);
        if (editorRef.current) {
          editorRef.current.innerHTML = newContent;
        }
      });

    return () => {
      if (client) {
        try {
          client.disconnect();
        } catch (error) {
        }
      }
    };
  }, []);

  const sendUpdate = (updateContent) => {
    if (stompClient && stompClient.connected) {
      const update = { content: updateContent };
      try {
        stompClient.send("/app/updateDocument", {}, JSON.stringify(update));
      } catch (error) {
      }
    }
  };

  const handleInput = () => {
    saveSelection();
    const newContent = editorRef.current.innerHTML;
    setContent(newContent);
    sendUpdate(newContent);
  };

  const applyFormat = (command, value = null) => {
    saveSelection();
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleFontSizeChange = (event) => {
    const newSize = event.target.value;
    setFontSize(newSize);
    applyFormat("fontSize", newSize);
  };

  const saveSelection = () => {
    if (window.getSelection && editorRef.current) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        savedRangeRef.current = selection.getRangeAt(0);
      }
    }
  };

  const restoreSelection = () => {
    if (savedRangeRef.current && editorRef.current) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRangeRef.current);
    }
  };

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = content;
      restoreSelection();
    }
  }, [content]);

  return (
    <div className="editor-container">
      <div className="toolbar">
        <button className="toolbar-button" onClick={() => applyFormat("bold")}>
          Bold
        </button>
        <button className="toolbar-button" onClick={() => applyFormat("italic")}>
          Italic
        </button>
        <button className="toolbar-button" onClick={() => applyFormat("underline")}>
          Underline
        </button>
        <select
          className="toolbar-select"
          value={fontSize}
          onChange={handleFontSizeChange}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((size) => (
            <option key={size} value={size}>
              {size * 2 + 6}pt
            </option>
          ))}
        </select>
      </div>
      <div
        ref={editorRef}
        className="editor"
        contentEditable
        onInput={handleInput}
      />
    </div>
  );
}

export default App;