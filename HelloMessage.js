'use strict'

window.HelloMessage = React.createClass({
  displayName: 'HelloMessage',
  getInitialState(){
    return {type: 'say:'}
  },
  componentWillMount() {
    console.log('我就要开始渲染了。。。')
  },
  componentDidMount() {
    console.log('我已经渲染好了。。。')
  },

  changeType() {
    this.setState({type: 'shout:'})
  },

  render() {
    let props = {
      onclick: this.changeType.bind(this),
    }
    return React.createElement("div", props, this.state.type, "Hello ", this.props.name);
  }
})
