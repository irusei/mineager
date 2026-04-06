import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import {AddServer} from "./windows/AddServer.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
          <Route path={"/"} element={<App/>}/>
          <Route path={"/add-server"} element={<AddServer/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});
