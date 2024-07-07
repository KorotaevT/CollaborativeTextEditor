import "./App.css";
import { Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import DocumentEdit from "./DocumentEdit";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/edit/:id" element={<DocumentEdit />} />
    </Routes>
  );
  
}

export default App;