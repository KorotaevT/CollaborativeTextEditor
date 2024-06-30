import React, { useEffect, useState, useRef } from "react";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";

function App() {
  const [content, setContent] = useState("");
  const [stompClient, setStompClient] = useState(null);
  const [fontSize, setFontSize] = useState("");
  const editorRef = useRef(null);
  const savedRangeRef = useRef(null);

  useEffect(() => {
    const socket = new SockJS("http://localhost:8080/ws");
    const client = Stomp.over(socket);

    client.connect({}, () => {
      client.subscribe(
        "/topic/updates",
        (message) => {
          if (message.body) {
            const newContent = JSON.parse(message.body).content;
            setContent(newContent);
            if (editorRef.current) {
              editorRef.current.innerHTML = newContent;
              restoreSelection();
            }
          }
        },
        (error) => {
          if (!error.message.includes("ERR_STREAM_WRITE_AFTER_END")) {
            console.error(error);
          }
        }
      );
    }, (error) => {
      console.error("Connection error:", error);
    });

    setStompClient(client);

    fetch("http://localhost:8080/api/getDocument")
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
          console.error("Disconnection error:", error);
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
        console.error("Send update error:", error);
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
    document.execCommand("fontSize", false, newSize);
    handleInput();
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
          const nextCharIndex = charIndex.start + node.length;
          if (
            !foundStart &&
            savedRangeRef.current.start >= charIndex.start &&
            savedRangeRef.current.start <= nextCharIndex
          ) {
            range.setStart(node, savedRangeRef.current.start - charIndex.start);
            foundStart = true;
          }
          if (
            foundStart &&
            savedRangeRef.current.end >= charIndex.start &&
            savedRangeRef.current.end <= nextCharIndex
          ) {
            range.setEnd(node, savedRangeRef.current.end - charIndex.start);
            stop = true;
          }
          charIndex.start = nextCharIndex;
        } else {
          for (let i = node.childNodes.length - 1; i >= 0; i--) {
            nodeStack.push(node.childNodes[i]);
          }
        }
      }

      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const updateFontSize = () => {
    if (window.getSelection) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const parentElement = range.commonAncestorContainer.parentElement;
        if (parentElement && parentElement.nodeName === "FONT") {
          const size = parentElement.size;
          setFontSize(size);
        } else {
          setFontSize("");
        }
      } else {
        setFontSize("");
      }
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
        <button
          className="toolbar-button"
          onClick={() => applyFormat("underline")}
        >
          Underline
        </button>
        <select
          className="toolbar-select"
          value={fontSize}
          onChange={handleFontSizeChange}
          onMouseDown={() => saveSelection()} // Save selection before showing dropdown
        >
          <option value="">--</option>
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
        onClick={updateFontSize}
        onKeyUp={updateFontSize}
        onMouseUp={updateFontSize}
      />
    </div>
  );
}

export default App;