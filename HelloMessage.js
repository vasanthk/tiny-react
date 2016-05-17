'use strict'

class HelloMessage extends React.Component {
  constructor(props) {
    super(props)
    this.state = { type: 'say' }
    this.changeType = () => {
      if (this.state.type === 'say') {
        this.setState({ type: 'shout' })
      } else {
        this.setState({ type: 'say' })
      }
    }
  }

  componentWillMount() {
    console.log('HelloMessage#willMount')
  }

  componentDidMount() {
    console.log('HelloMessage#didMount')
  }

  componentDidUpdate() {
    console.log('HelloMessage#didUpdate')
  }

  render() {
    const children = [this.state.type, "Hello ", this.props.name]
    const props = {
      onclick: this.changeType,
    }
    return React.createElement('div', props, ...children)
  }
}
