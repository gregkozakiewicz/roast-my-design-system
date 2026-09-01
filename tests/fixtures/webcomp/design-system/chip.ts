class ChipEl extends HTMLElement { connectedCallback() { this.textContent = "chip"; } }
customElements.define("acme-chip", ChipEl);
export { ChipEl };
