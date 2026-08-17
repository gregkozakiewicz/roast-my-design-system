import React from 'react';
import Login from './components/Login';
import { Panel } from './components/Panel';
class App extends React.Component {
  render() { return <div className="App"><Login /><Panel title="a" /><Panel title="b" /></div>; }
}
export default App;
