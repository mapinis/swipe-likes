import { render, screen } from "@testing-library/react";
import { App } from "./App.tsx";

test("shows the login screen when not authenticated", async () => {
  render(<App />);
  expect(await screen.findByText("Liked Songs Swiper")).toBeInTheDocument();
});
