import React from 'react';
import { connect } from 'react-redux';
class Login extends React.Component {
  render() { return <form style={{ margin: '9px' }}><button>Go</button></form>; }
}
export default connect(null)(Login);
