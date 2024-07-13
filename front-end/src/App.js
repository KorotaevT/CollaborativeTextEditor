import "./App.css";
import { Route, Routes } from "react-router-dom";
import Homepage from "./Homepage";
import DocumentEdit from "./DocumentEdit";
import PrivateRoute from "./PrivateRoute";
import Login from "./Login";
import Register from "./Register";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {

  return (
    <Routes>
      <Route path="/registration" element={<Register />} />
      <Route path="/" element={<Homepage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/edit/:id" element={<PrivateRoute><DocumentEdit /></PrivateRoute>} />
    </Routes>
  );
  
}

export default App;