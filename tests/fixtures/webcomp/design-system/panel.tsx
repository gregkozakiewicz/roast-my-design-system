import { Component, h } from "@stencil/core";

@Component({ tag: "acme-panel", styleUrl: "../styles/main.css" })
export class Panel {
  render() { return <div class="acme-panel"><slot /></div>; }
}
