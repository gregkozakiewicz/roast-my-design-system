import { Component, h } from "@stencil/core";

@Component({ tag: "acme-divider" })
export class Divider {
  render() { return <hr class="acme-divider" />; }
}
