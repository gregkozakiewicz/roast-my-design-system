import { Component, h } from "@stencil/core";

@Component({ tag: "acme-card", styleUrl: "../styles/main.css" })
export class Card {
  render() { return <div class="acme-card"><slot /></div>; }
}
