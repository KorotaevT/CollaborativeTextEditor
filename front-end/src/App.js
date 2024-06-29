import "./App.css";
import { Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {

  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
    </Routes>
  );
  
}

export default App;