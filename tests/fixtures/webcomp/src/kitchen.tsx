import { Component, h } from "@stencil/core";

@Component({ tag: "acme-kitchen" })
export class Kitchen {
  render() {
    return (
      <acme-card>
        <acme-button>one</acme-button>
        <acme-button>two</acme-button>
        <acme-button>three</acme-button>
        <acme-icon></acme-icon>
        <acme-chip></acme-chip>
        <acme-panel><acme-card>inner</acme-card></acme-panel>
      </acme-kitchen>
    );
  }
}
