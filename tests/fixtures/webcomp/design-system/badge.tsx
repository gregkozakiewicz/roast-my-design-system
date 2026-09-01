import { Component, h } from "@stencil/core";

@Component({ tag: "acme-badge", styleUrl: "../styles/main.css" })
export class Badge {
  render() { return <div class="acme-badge"><slot /></div>; }
}
