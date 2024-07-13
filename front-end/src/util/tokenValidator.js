import ajax from "../Services/fetchService";

const validateToken = async (jwt) => {
  try {
    const response = await ajax(`/api/auth/validation?token=${jwt}`, "GET", jwt);
    return response;
  } catch (error) {
    console.error("Error validating token:", error);
    return false;
  }
};

export default validateToken;