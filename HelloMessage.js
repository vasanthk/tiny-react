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

  componentWillUpdate(nextProps, nextState) {
    console.group('HelloMessage#willUpdate')
    console.log('this.props:', this.props)
    console.log('next.props:', nextProps)
    console.log('this.state:', this.state)
    console.log('next.state:', nextState)
    console.groupEnd()
  }

  shouldComponentUpdate() {
    console.log('HelloMessage#shouldComponentUpdate')
    return true
  }

  componentDidUpdate(prevProps, prevState) {
    console.group('HelloMessage#didUpdate')
    console.log('prev.props:', prevProps)
    console.log('this.props:', this.props)
    console.log('prev.state:', prevState)
    console.log('this.state:', this.state)
    console.groupEnd()
  }

  render() {
    const children = [this.state.type, "Hello ", this.props.name]
    const props = {
      onclick: this.changeType,
    }
    return React.createElement('div', props, ...children)
  }
}
