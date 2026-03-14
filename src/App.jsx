import TableTennisApp from "./TableTennisApp";
import React, { useState } from "react";

export default function App() {
  const [mode, setMode] = useState("user");
  return <TableTennisApp mode={mode} setMode={setMode} />;
}
