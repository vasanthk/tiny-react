'use strict'

class ReactElement {
  constructor(type, key, props) {
    this.type = type
    this.key = key
    this.props = props
  }
}

class ReactClass {
  render() {
  }
}

class ReactDOMTextComponent {
  constructor(text) {
    this._currentElement = String(text)
    this._rootNodeID = null
  }

  mountComponent(rootID) {
    this._rootNodeID = rootID
    return `<span data-reactid=${rootID}>${this._currentElement}</span>`
  }
}

class ReactDOMComponent {
  constructor(element) {
    this._currentElement = element
    this._rootNodeID = null
  }

  mountComponent(rootID) {
    this._rootNodeID = rootID
    let props = this._currentElement.props
    let type = this._currentElement.type
    let tagOpen = `<${type} data-reactid=${this._rootNodeID}`
    let tagClose = `</${type}>`

    for (let propKey in props) {
      if (!props.hasOwnProperty(propKey))
        continue
      if (/^on[A-Za-z]/.test(propKey)) {
        let eventType = propKey.replace('on', '')
        // 针对当前的节点添加事件代理,以_rootNodeID为命名空间
        $(document).delegate(
          `[data-reactid="${this._rootNodeID}"]`,
          eventType + '.' + this._rootNodeID,
          props[propKey]
        )
        // document.addEventListener(`${eventType}.${this._rootNodeID}`, props[propKey])
      }
      // 对于children属性以及事件监听的属性不需要进行字符串拼接
      // 事件会代理到全局 这边不能拼到dom上不然会产生原生的事件监听
      if (props[propKey] && propKey != 'children' && !/^on[A-Za-z]/.test(propKey)) {
        tagOpen += ` ${propKey}=${props[propKey]}`
      }
    }

    //获取子节点渲染出的内容
    let content = ''
    let children = props.children || []
    let childrenInstances = []
    children.forEach((child, key)=> {
      //这里再次调用了instantiateReactComponent实例化子节点component类，拼接好返回
      let childComponentInstance = instantiateReactComponent(child)
      childComponentInstance._mountIndex = key

      childrenInstances.push(childComponentInstance)
      //子节点的rootId是父节点的rootId加上新的key也就是顺序的值拼成的新值
      let curRootId = `${this._rootNodeID}.${key}`
      //得到子节点的渲染内容
      let childMarkup = childComponentInstance.mountComponent(curRootId)
      //拼接在一起
      content += ' ' + childMarkup
    })

    //留给以后更新时用的这边先不用管
    this._renderedChildren = childrenInstances

    //拼出整个html内容
    return tagOpen + '>' + content + tagClose
  }
}

class ReactCompositeComponent {
  constructor(element) {
    //存放元素element对象
    this._currentElement = element
    //存放唯一标识
    this._rootNodeID = null
    //存放对应的ReactClass的实例
    this._instance = null
  }

  mountComponent(rootID) {
    this._rootNodeID = rootID
    // 拿到当前元素对应的属性值
    let publicProps = this._currentElement.props
    // 拿到对应的ReactClass
    let ReactClass = this._currentElement.type
    // Initialize the public class
    var inst = new ReactClass(publicProps)
    this._instance = inst
    //保留对当前comonent的引用，下面更新会用到
    inst._reactInternalInstance = this

    if (inst.componentWillMount) {
      inst.componentWillMount()
      //这里在原始的reactjs其实还有一层处理，就是componentWillMount调用setstate，
      //不会触发rerender而是自动提前合并，这里为了保持简单，就略去了
    }

    // 调用ReactClass的实例的render方法,返回一个element或者一个文本节点
    let renderedElement = this._instance.render()
    // 得到renderedElement对应的component类实例
    let renderedComponentInstance = instantiateReactComponent(renderedElement)
    this._renderedComponent = renderedComponentInstance // 存起来留作后用

    // 拿到渲染之后的字符串内容，将当前的_rootNodeID传给render出的节点
    let renderedMarkup = renderedComponentInstance.mountComponent(this._rootNodeID)

    // 之前我们在React.render方法最后触发了mountReady事件，
    // 所以这里可以监听，在渲染完成后会触发。
    document.addEventListener('mountReady',
      ()=>inst.componentDidMount && inst.componentDidMount())

    return renderedMarkup
  }
}

function instantiateReactComponent(node) {
  // 文本节点的情况
  if (typeof node === 'string' || typeof node === 'number') {
    return new ReactDOMTextComponent(node)
  }
  // 浏览器默认节点的情况
  if (typeof node === 'object' && typeof node.type === 'string') {
    return new ReactDOMComponent(node)
  }
  //自定义的元素节点
  if (typeof node === 'object' && typeof node.type === 'function') {
    //注意这里，使用新的component,专门针对自定义元素
    return new ReactCompositeComponent(node)
  }
}

window.React = {
  nextReactRootIndex: 0,

  render(element, container){
    let instance = instantiateReactComponent(element)
    let markup = instance.mountComponent(React.nextReactRootIndex++)
    container.innerHTML = markup
    document.dispatchEvent(new Event('mountReady'))
  },

  createElement(type, config = {}, ...children) {
    let props = {}
    let key = config.key || null

    for (let propName in config) {
      if (config.hasOwnProperty(propName) && propName !== 'key') {
        props[propName] = config[propName]
      }
    }

    props.children = children

    return new ReactElement(type, key, props)
  },

  createClass(spec){
    //生成一个子类
    let Constructor = function (props) {
      this.props = props
      this.state = this.getInitialState ? this.getInitialState() : null
    }
    //原型继承，继承超级父类
    Constructor.prototype = new ReactClass()
    Constructor.prototype.constructor = Constructor
    Object.assign(Constructor.prototype, spec)
    return Constructor
  }
}

window.HelloMessage = React.createClass({
  getInitialState(){
    return {type: 'say:'}
  },
  componentWillMount() {
    console.log('我就要开始渲染了。。。')
  },
  componentDidMount() {
    console.log('我已经渲染好了。。。')
  },

  render() {
    return React.createElement("div", undefined, this.state.type, "Hello ", this.props.name);
  }
})