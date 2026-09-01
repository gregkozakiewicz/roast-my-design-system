import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("acme-icon") export class Icon extends LitElement {
  render() { return html`<span></span>`; }
}
