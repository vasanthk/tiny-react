'use strict'

class HelloMessage extends React.Component {
  constructor(props){
    super(props)
    this.state = { type: 'say' }
  }

  componentWillMount() {
    console.log('HelloMessage#willMount')
  }

  componentDidMount() {
    console.log('HelloMessage#didMount')
  }

  render() {
    const children = [this.state.type, "Hello ", this.props.name]
    return React.createElement('div', null, ...children)
  }
}
