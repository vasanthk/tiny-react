'use strict'

const TodoList = React.createClass({
  displayName: 'TodoList',
  getInitialState() {
    return {
      items: [],
      text: '',
    }
  },

  add() {
    let nextItems = this.state.items.concat([this.state.text])
    this.setState({items: nextItems, text: ''})
  },

  onChange(event) {
    this.setState({text: event.target.value})
  },

  render() {
    const createItem = function (itemText) {
      return React.createElement('div', undefined, itemText)
    }

    let lists = this.state.items.map(createItem)
    let input = React.createElement('input', {
      onkeyup: this.onChange.bind(this),
      value: this.state.text,
    })
    let button = React.createElement('button', {
      onclick: this.add.bind(this),
    }, 'Add#' + this.state.items.length)
    let children = lists.concat([input, button])

    return React.createElement('div', null, ...children)
  }
})