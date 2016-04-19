'use strict'

class ReactElement {
  constructor(type, key, props) {
    this.type = type
    this.key = key
    this.props = props
  }
}

class ReactClass {
  /**
   * @abstract
   */
  render() {
  }

  setState(newState) {
    this._reactInternalInstance.receiveComponent(null, newState)
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

  receiveComponent(nextText) {
    let nextStringText = String(nextText)
    if (nextStringText !== this._currentElement) {
      this._currentElement = nextStringText
      // 替换整个节点
      $(`[data-reactid="${this._rootNodeID}"]`).html(this._currentElement)
    }
  }
}


const UPDATE_TYPES = {
  MOVE_EXISTING: 'MOVE_EXISTING',
  REMOVE_NODE: 'REMOVE_NODE',
  INSERT_MARKUP: 'INSERT_MARKUP',
}

// 全局的更新深度标志
let updateDepth = 0
// 全局的更新队列, 所有的差异都存在这里
let diffQueue = []

class ReactDOMComponent {
  constructor(element) {
    this._currentElement = element
    this._rootNodeID = null
    this._renderedChildren = null
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

  receiveComponent(nextElement) {
    let lastProps = this._currentElement.props
    let nextProps = nextElement.props

    this._currentElement = nextElement
    // 需要单独的更新属性
    this._updateDOMProperties(lastProps, nextProps)
    // 再更新子节点
    this._updateDOMChildren(nextElement.props.children)
  }

  _updateDOMProperties(lastProps, nextProps) {
    // 遍历, 当一个老的属性不在新的属性集合里时, 需要删去
    for (let propKey in lastProps) {
      if (!lastProps.hasOwnProperty(propKey) || nextProps.hasOwnProperty(propKey))
        continue

      // 对于那种特殊的, 比如这里的事件监听的属性我们需要去掉监听
      if (/^on[A-Za-z]/.test(propKey)) {
        let eventType = propKey.replace('on', '')
        // 针对当前的节点取消事件代理
        $(document).undelegate(`[data-reactid="${this._rootNodeID}"]`, eventType)
        continue
      }

      // 从dom上删除不需要的属性
      $(`[data-reactid="${this._rootNodeID}"]`).removeAttr(propKey)
    }

    // 对于新的属性, 需要写到dom节点上
    for (let propKey in nextProps) {
      if (!nextProps.hasOwnProperty(propKey))
        continue
      // 对于事件监听的属性我们需要特殊处理
      if (/^on[A-Za-z]/.test(propKey)) {
        let eventType = propKey.replace('on', '')
        // 以前如果已经有, 说明有了监听, 需要先去掉
        if (lastProps[propKey]) {
          $(document).undelegate(
            `[data-reactid="${this._rootNodeID}'"]`,
            eventType,
            lastProps[propKey])
        }
        // 针对当前的节点添加事件代理, 以_rootNodeID为命名空间
        $(document).delegate(
          `[data-reactid="${this._rootNodeID}"]`,
          `${eventType}.${this._rootNodeID}`,
          nextProps[propKey]
        )
        continue
      }

      if (propKey === 'children')
        continue

      // 添加新的属性, 或是是更新老的同名属性
      $(`[data-reactid="${this._rootNodeID}"]`).prop(propKey, nextProps[propKey])
    }
  }

  _updateDOMChildren(nextChildrenElements) {
    updateDepth++
    //_diff 用来递归找出差别, 组装差异对象, 添加到更新队列diffQueue
    this._diff(diffQueue, nextChildrenElements)
    console.log(diffQueue)
    updateDepth--
    if (updateDepth == 0) {
      // 在需要的时候调用patch, 执行具体的dom操作
      this._patch(diffQueue)
      diffQueue = []
    }
  }

  _diff(diffQueue, nextChildrenElements) {
    // 拿到之前的子节点的 component类型对象的集合,
    // 这个是在刚开始渲染时赋值的，记不得的可以翻上面
    // _renderedChildren 本来是数组，我们搞成map
    let prevChildren = flattenChildren(this._renderedChildren)
    // 生成新的子节点的component对象集合, 这里注意, 会服用老的component对象
    let nextChildren = generateComponentChildren(prevChildren, nextChildrenElements)

    // 重新赋值_renderedChildren, 使用最新的
    this._renderedChildren = []
    $.each(nextChildren, (key, instance)=> {
      this._renderedChildren.push(instance)
    })


    let nextIndex = 0 // 代表到达的新的节点的index
    for (let name in nextChildren) {
      if (!nextChildren.hasOwnProperty(name)) {
        continue
      }
      let prevChild = prevChildren && prevChildren[name]
      let nextChild = nextChildren[name]

      // 相同的话, 说明是使用的同一个component, 所以我们需要做移动的操作
      if (prevChild === nextChild) {
        // 添加差异对象, 类型: MOVE_EXISTING
        diffQueue.push({
          parentId: this._rootNodeID,
          parentNode: $(`[data-reactid="${this._rootNodeID}"]`),
          type: UPDATE_TYPES.MOVE_EXISTING,
          fromIndex: prevChild._mountIndex,
          toIndex: nextIndex,
        })
      } else { // 如果不相同, 说明是新增加的节点
        // 但是如果老的还存在, 就是element不同, 但是component一样
        // 我们需要把它对应的老的element删除
        if (prevChild) {
          // 添加差异对象, 类型: REMOVE_NODE
          diffQueue.push({
            parentId: this._rootNodeID,
            parentNode: $(`[data-reactid="${this._rootNodeID}"]`),
            type: UPDATE_TYPES.REMOVE_NODE,
            fromIndex: prevChild._mountIndex,
          })
        }

        // 如果以前已经渲染过了, 记得先去掉以前所有的事件监听, 通过命名空间全部清空
        if (prevChild._rootNodeID) {
          $(document).undelegate('.' + prevChild._rootNodeID)
        }

        // 新增加的节点, 也组装差异对象放到队列里
        diffQueue.push({
          parentId: this._rootNodeID,
          parentNode: $(`[data-reactid="${this._rootNodeID}"]`),
          type: UPDATE_TYPES.INSERT_MARKUP,
          fromIndex: null,
          toIndex: nextIndex,
          // 新增的节点, 多一个此属性, 表示新建节点DOM内容
          markup: nextChild.mountComponent(),
        })
      }
      // 更新mount的index
      nextChild._mountIndex = nextIndex
      nextIndex++
    }

    // 对于老的节点里有, 新的节点里没有的那些, 也全都删除掉
    for (let name in prevChildren) {
      if (prevChildren.hasOwnProperty(name) && !(nextChildren && nextChildren.hasOwnProperty(name))) {
        // 添加差异对象, 类型: REMOVE_NODE
        diffQueue.push({
          parentId: this._rootNodeID,
          parentNode: $(`[data-reactid="${this._rootNodeID}"]`),
          type: UPDATE_TYPES.REMOVE_NODE,
          fromIndex: prevChildren._mountIndex,
          toIndex: null,
        })
        // 如果以前已经渲染过了, 记得先去掉以前所有的监听事件
        if (prevChildren[name]._rootNodeID) {
          $(document).undelegate('.' + prevChildren[name]._rootNodeID)
        }
      }
    }
  }

  _patch() {
  } // todo
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
    //保留对当前component的引用，下面更新会用到
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

    /**
     如果renderedComponentInstance是一个ReactDOMTextComponent,
     那么调用mountComponent将直接获得markup(即HTML字符串)

     如果renderedComponentInstance是ReactDOMComponent
     那么....

     如果renderedComponentInstance是ReactCompositeComponent,
     那么renderedComponentInstance.mountComponent就是当前函数,
     即递归调用了当前函数; 也就是说, 如果MyReact遇到了ReactCompositeComponent,
     会一直递归的去调用mountComponent, 直到MyReact遇到DOMComponent或DOMTextComponent为止

     */
    // 拿到渲染之后的字符串内容，将当前的_rootNodeID传给render出的节点
    let renderedMarkup = renderedComponentInstance.mountComponent(this._rootNodeID)

    // 之前我们在React.render方法最后触发了mountReady事件，
    // 所以这里可以监听，在渲染完成后会触发。
    document.addEventListener('mountReady',
      ()=>inst.componentDidMount && inst.componentDidMount())

    return renderedMarkup
  }

  receiveComponent(nextElement, newState) {
    // 如果接受了新的element, 就使用新的element
    this._currentElement = nextElement || this._currentElement

    let instance = this._instance
    // 合并state
    let nextState = Object.assign({}, instance.state, newState)
    let nextProps = this._currentElement.props

    // 改写state
    instance.state = nextState

    // 如果instance有shouldComponentUpdate并且返回false
    // 说明组件自身判断不需要更新, 就直接返回
    if (instance.shouldComponentUpdate && !(instance.shouldComponentUpdate(nextProps, nextState)))
      return

    // 生命周期管理, 如果有componentWillUpdate, 就调用, 表示开始要更新了
    if (instance.componentWillUpdate)
      instance.componentWillUpdate(nextProps, nextState)


    let prevComponentInstance = this._renderedComponent
    let prevRenderedElement = prevComponentInstance._currentElement
    // 重新执行render拿到对应的新element
    let nextRenderedElement = instance.render()


    // 判断是否需要更新还是直接就重新渲染
    // 注意这里的_shouldUpdateReactComponent跟上面的不同哦 这个是全局的方法
    if (_shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
      // 如果需要更新, 就继续调用子节点的receiveComponent, 传入新的element更新子节点
      prevComponentInstance.receiveComponent(nextRenderedElement)
      // 调用componentDidUpdate表示更新完成了
      if (instance.componentDidUpdate)
        instance.componentDidUpdate()
    } else {
      // 如果发现完全是不同的两种element, 那就干脆重新渲染了
      let thisID = this._rootNodeID
      // 重新new一个对应的component
      this._renderedComponent = instantiateReactComponent(nextRenderedElement)
      let nextMarkup = this._renderedComponent.mountComponent(thisID)
      // 替换整个节点
      $(`[data-reactid="${this._rootNodeID}"]`).replaceWith(nextMarkup)
    }
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
