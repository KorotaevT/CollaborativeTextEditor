import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../UserProvider";
import {
  MDBContainer,
  MDBInput,
  MDBCol,
  MDBRow,
  MDBCard,
  MDBCardBody,
} from "mdb-react-ui-kit";
import { Button } from "react-bootstrap";

const Register = () => {
  const user = useUser();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function sendRegisterRequest() {
    const reqBody = {
      username: username,
      password: password,
    };

    fetch(`/api/auth/registration`, {
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(reqBody),
    })
      .then((response) => {
        if (response.status === 200)
          return Promise.all([response.json(), response.headers]);
        else return Promise.reject("Error in creating an account");
      })
      .then(([body, headers]) => {
        user.setJwt(headers.get("authorization"));
        window.location.href = "/";
      })
      .catch((message) => {
        alert(message);
      });
  }

  return (
    <MDBContainer
      fluid
      style={{
        backgroundColor: "#ffffff",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <MDBRow className="d-flex justify-content-center align-items-center h-100">
        <MDBCol col="12">
          <MDBCard
            className="bg-white my-5 mx-auto"
            style={{
              borderRadius: "1rem",
              maxWidth: "500px",
              border: "8px solid #508bfc",
            }}
          >
            <MDBCardBody className="p-5 w-100 d-flex flex-column">
              <h2 className="fw-bold mb-2 text-center">Регистрация</h2>
              <p className="text-white-50 mb-3">
                Please enter your login and password!
              </p>

              <MDBInput
                wrapperClass="mb-4 w-100"
                type="text"
                size="lg"
                value={username}
                placeholder="Введите ваше ФИО"
                onChange={(event) => setUsername(event.target.value)}
                style={{ border: "2px solid #ccc" }}
              />
              <MDBInput
                wrapperClass="mb-4 w-100"
                type="password"
                size="lg"
                value={password}
                placeholder="Введите пароль"
                onChange={(event) => setPassword(event.target.value)}
                style={{ border: "2px solid #ccc" }}
              />

              <Button
                size="lg"
                id="submit"
                type="button"
                onClick={() => sendRegisterRequest()}
              >
                Создать аккаунт
              </Button>

              <p className="text-center" style={{ marginTop: "20px" }}>
                Уже есть аккаунт?{" "}
                <a href=" " onClick={() => navigate("/login")}>
                  Войти
                </a>
              </p>
              
            </MDBCardBody>
          </MDBCard>
        </MDBCol>
      </MDBRow>
    </MDBContainer>
  );
};

export default Register;
