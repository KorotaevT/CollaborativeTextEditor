function ajax(url, requestMethod, jwt, requestBody) {
  const fetchData = {
    headers: {
      "Content-type": "application/json",
    },
    method: requestMethod,
  };

  if (jwt) {
    fetchData.headers.Authorization = `Bearer ${jwt}`;
  }

  if (requestBody) {
    fetchData.body = JSON.stringify(requestBody);
  }

  return fetch(url, fetchData).then((response) => {
    const contentType = response.headers.get("Content-Type");

    if (!response.ok) {
      return response.json().then((error) => {
        throw new Error(error.message || "Произошла ошибка при выполнении запроса");
      });
    }

    if (contentType && contentType.includes("application/json")) {
      return response.json();
    } else if (contentType && (
      contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
      contentType.includes("application/octet-stream")
    )) {
      return response.blob();
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  });
}

export default ajax;
