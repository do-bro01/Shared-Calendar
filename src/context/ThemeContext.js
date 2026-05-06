import React, { createContext, useContext, useState } from "react";
import { Colors } from "../../constants/theme";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState("light");

  const toggle = () => setMode((m) => (m === "light" ? "dark" : "light"));

  const theme = {
    mode,
    colors: mode === "light" ? Colors.light : Colors.dark,
    toggle,
  };

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
