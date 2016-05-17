'use strict'

class ReactElement {
  constructor(type, key, props) {
    this.type = type
    this.key = key
    this.props = props
  }
}

// component工厂, 用来返回一个component实例
function instantiateReactComponent(node) {
  // 文本节点情况
  if (typeof node === 'string' || typeof node === 'number') {
    return new ReactDOMTextComponent(node)
  }
  // DOM节点(浏览器默认节点)的情况
  if (typeof node === 'object' && typeof node.type === 'string') {
    return new ReactDOMComponent(node)
  }
  if (typeof node === 'object' && typeof node.type === 'function') {
    return new ReactCompositeComponent(node)
  }
}

// component类, 用来表示文本在渲染, 更新, 删除时应该做些什么事情
class ReactDOMTextComponent {
  constructor(text) {
    this._currentElement = String(text)
    this._rootNodeId = null
  }

  // component渲染时生成的DOM结构
  mountComponent(rootId) {
    this._rootNodeId = rootId
    return `<span data-reactid="${rootId}">${this._currentElement}</span>`
  }
}

class ReactDOMComponent {
  constructor(element) {
    this._currentElement = element
    this._rootNodeId = null
    this._renderedChildren = null
  }

  mountComponent(rootId) {
    this._rootNodeId = rootId
    const props = this._currentElement.props
    const propsTextList = []

    // 拼凑出属性
    for (const propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        return
      }
      if (/^on[A-Za-z]/.test(propKey)) { // 进行时间的监听
        const eventType = propKey.replace('on', '')
        // 针对当前的节点添加时间代理, 以_rootNodeId为命名空间
        $(document).delegate(`[data-reactid="${this._rootNodeId}"]`, eventType, props[propKey])
      }

      // 对于children属性以及事件监听的属性不需要进行字符串拼接
      // 事件会代理到全局. 这边不能频道dom上不然会产生原生的事件监听
      if (props[propKey] && propKey !== 'children' && !/^on[A-Za-z]/.test(propKey)) {
        propsTextList.push(`${propKey}=${props[propKey]}`)
      }
    }

    // 获取子节点渲染的内容
    let content = ''
    const children = props.children || []
    const childrenInstances = [] // 用于保存所有的子节点的component实例, 以后会用到
    $.each(children, (index, child) => {
      // 这里再次调用了instantiateReactComponent实例化子节点component类, 拼接好返回
      const childComponentInstance = instantiateReactComponent(child)
      childComponentInstance._mountIndex = index

      childrenInstances.push(childComponentInstance)

      // 子节点的rootId是副节点的rootId加上新的key
      const curRootId = `${this._rootNodeId}.${index}`
      // 得到子节点的渲染内容
      const childMarkup = childComponentInstance.mountComponent(curRootId)
      // 拼接并返回
      content += ' ' + childMarkup
    })

    this._renderedChildren = childrenInstances

    return `<${this._currentElement.type} data-reactid="${this._rootNodeId}" ${propsTextList.join(' ')}>${content}</${this._currentElement.type}>`
  }
}

class ReactCompositeComponent {
  constructor(element) {
    this._currentElement = element
    this._rootNodeId = null
    this._instance = null
    this._renderedComponent = null
  }

  mountComponent(rootId) {
    this._rootNodeId = rootId
    const publicProps = this._currentElement.props
    const ReactClass = this._currentElement.type
    const inst = new ReactClass(publicProps)
    this._instance = inst
    inst._reactInternalInstance = this

    if (inst.componentWillMount) {
      inst.componentWillMount()
      // 这里在原始的reactjs其实还有一层处理, 就是componentWillMount调用setState,
      // 不会触发rerender而是自动提前合并, 这里为了保持简单, 就略去了
    }
    const renderedElement = this._instance.render()
    // 得到renderedElement'对应的component实例
    const renderedComponentInstance = instantiateReactComponent(renderedElement)
    this._renderedComponent = renderedComponentInstance // 存起来留作后用

    // 拿到渲染之后的字符串内容，将当前的_rootNodeID传给render出的节点
    var renderedMarkup = renderedComponentInstance.mountComponent(this._rootNodeId);
    //之前我们在React.render方法最后触发了mountReady事件，所以这里可以监听，在渲染完成后会触发。
    $(document).on('mountReady', function () {
      inst.componentDidMount && inst.componentDidMount()
    })

    return renderedMarkup
  }
}

const React = {
  nextReactRootIndex: 0,

  render(element, container) {
    const componentInstance = instantiateReactComponent(element)
    const markup = componentInstance.mountComponent(React.nextReactRootIndex++)
    $(container).html(markup)
    $(document).trigger('mountReady')
  },

  createElement(type, config = {}, ...children) {
    const key = (config && config.key) || null
    // 复制config里的内容到props
    const props = Object.assign({}, config, { children: children })
    delete props['key']
    return new ReactElement(type, key, props)
  },

  Component: class {
    constructor(props) {
      this.props = props
      this.state = null
    }
  }
}
