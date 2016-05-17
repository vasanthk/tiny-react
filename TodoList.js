'use strict'

class TodoList extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      items: [],
      text: '',
    }

    this.onChange = event => {
      this.setState({ text: event.target.value })
    }

    this.add = () => {
      const { items, text } = this.state
      this.setState({
        text: '',
        items: items.concat([text]),
      })
    }
  }

  // componentWillUpdate(nextProps, nextState) {
  //   console.group('HelloMessage#willUpdate')
  //   console.log('this.props:', this.props)
  //   console.log('next.props:', nextProps)
  //   console.log('this.state:', this.state)
  //   console.log('next.state:', nextState)
  //   console.groupEnd()
  // }

  render() {
    const { items, text } = this.state
    const count = items.length
    const lists = items.map(item => React.createElement('p', null, item))
    const input = React.createElement('input', { type: 'text', onkeyup: this.onChange })
    const button = React.createElement('button', { onclick: this.add }, 'Add#', String(count + 1))
    const children = [input, button].concat(lists)
    return React.createElement('div', null, ...children)
  }
}
