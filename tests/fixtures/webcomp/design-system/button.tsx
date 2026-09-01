import { Component, h } from "@stencil/core";

@Component({ tag: "acme-button", styleUrl: "../styles/main.css" })
export class Button {
  render() { return <div class="acme-button"><slot /></div>; }
}
