'use strict'

class ReactElement {
  constructor(type, key, props) {
    this.type = type
    this.key = key
    this.props = props
  }
}

// 用来判断两个element需要需要更新
// 这里的key是我们createElement的时候可以选择性的传入的, 用来标志这个element,
// 当发现key不同的时候, 我们可以直接进行渲染, 不需要再去更新了
function _shouldUpdateReactComponent(prevElement, nextElement) {
  if (!prevElement || !nextElement) {
    return false
  }
  const prevType = typeof prevElement
  const nextType = typeof nextElement
  if (prevType === 'string' || prevType === 'number') {
    return nextType === 'string' || nextType === 'number'
  }
  return nextType === 'object'
    && prevElement.type === nextElement.type
    && prevElement.key === nextElement.key
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

// RDC的_renderedChildren是一个数组, 此方法把它转换成一个map, 可以就是element的key
// 如果是text节点或者是element创建的时候并没有传入key, 就直接用在数组里的index标识
function flattenChildren(componentChildren) {
  const childMap = {}
  componentChildren.forEach((child, index) => {
    const key = child && child._currentElement && child._currentElement.key ?
      child._currentElement.key : index.toString(36)
    childMap[key] = child
  })
  return childMap
}

// 主要用来生成子节点elements的component集合
// 这边注意, 有个逻辑判断逻辑, 如果发现是更新, 就会继续使用以前的componentInstance,
// 调用对应的receiveComponent, 如果是新的节点, 就会重新生成一个新的componentInstance
function generateComponentChildren(prevChildren, nextChildrenElements = []) {
  const nextChildren = {}
  $.each(nextChildrenElements, (index, element) => {
    const key = element.key ? element.key : index
    const prevChild = prevChildren && prevChildren[key]
    const prevElement = prevChild && prevChild._currentElement
    const nextElement = element

    // 调用_shouldUpdateReactComponent判断是否是更新
    if (_shouldUpdateReactComponent(prevElement, nextElement)) {
      // 更新的话直接递归调用子节点的receiveComponent就好了
      prevChild.receiveComponent(nextElement)
      // 然后继续使用老的component
      nextChildren[key] = prevChild
    } else {
      // 对于没有老的, 那就重新新增一个, 重新生成一个componet
      const nextChildInstance = instantiateReactComponent(nextElement)
      // 使用新的component
      nextChildren[key] = nextChildInstance
    }
  })
  return nextChildren
}

// 用于将childNode插入到指定位置
function insertChildAt(parentNode, childNode, index) {
  const beforeChild = parentNode.children().get(index)
  if (beforeChild) {
    childNode.insertBefore(beforeChild)
  } else {
    childNode.appendTo(parentNode)
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

  receiveComponent(nextText) {
    const nextStringText = String(nextText)
    // 跟以前保存的字符串比较
    if (nextStringText !== this._currentElement) {
      this._currentElement = nextStringText
      // 替换整个节点
      $(`[data-reactid="${this._rootNodeId}"]`).html(this._currentElement)
    }
  }
}

const UPDATE_TYPES = {
  MOVE_EXISTING: 1,
  REMOVE_NODE: 2,
  INSERT_MARKUP: 3,
}

let updateDepth = 0 // 全局的更新深度标识
let diffQueue = [] // 全局的更新队列, 所有的差异都存在这里
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
        $(document).delegate(
          `[data-reactid="${this._rootNodeId}"]`,
          `${eventType}.${this._rootNodeId}`,
          props[propKey]
        )
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

  receiveComponent(nextElement) {
    const lastProps = this._currentElement.props
    const nextProps = nextElement.props

    this._currentElement = nextElement
    // 需要单独的更新属性
    this._updateDOMProperties(lastProps, nextProps)
    // 在更新子节点
    this._updateDOMChildren(nextElement.props.children)
  }

  _updateDOMProperties(lastProps, nextProps) {
    const selector = `[data-reactid="${this._rootNodeId}"]`
    // 遍历, 当一个老的属性不在新的属性集合里时, 需要删除掉
    for (const propKey in lastProps) {
      // 新的属性里有，或者propKey是在原型上的直接跳过。
      // 这样剩下的都是不在新属性集合里的, 需要删除
      if (!lastProps.hasOwnProperty(propKey) || nextProps.hasOwnProperty(propKey)) {
        continue
      }
      // 如果是事件监听, 则需要去掉事件监听
      if (/^on[A-Za-z]/.test(propKey)) {
        const eventType = propKey.replace('on', '')
        // 针对当前节点取消事件代理
        $(document).undelegate(selector, eventType, lastProps[propKey])
      }
      // 从dom上删除不需要的属性
      $(selector).removeAttr(propKey)
    }

    // 对于新的属性, 需要写到dom节点上
    for (const propKey in nextProps) {
      if (!nextProps.hasOwnProperty(propKey) || propKey === 'children') {
        continue
      }
      if (/^on[A-Za-z]/.test(propKey)) {
        const eventType = propKey.replace('on', '')
        // 如果lastProps中含有propKey, 说明已经有了监听, 需要先去掉原来的监听
        if (lastProps.hasOwnProperty(propKey)) {
          $(document).undelegate(selector, eventType, lastProps[propKey])
        }
        // 针对当前的节点添加时间代理, 以_rootNodeId为命名空间
        $(document).delegate(selector,
          `${eventType}.${this._rootNodeId}`,
          nextProps[propKey])
        continue
      }
      // 添加新的属性, 或者是更新老的同名属性
      $(selector).prop(propKey, nextProps[propKey])
    }
  }

  _updateDOMChildren(nextChildrenElements) {
    updateDepth++
    // _diff用来递归找出差别, 组装差异对象, 添加到更新队列diffQueue
    this._diff(diffQueue, nextChildrenElements)
    updateDepth--
    if (updateDepth === 0) {
      // 在需要的时候调用patch, 执行具体的dom操作
      this._patch(diffQueue)
      diffQueue = []
    }
  }

  // _diff用来递归找出差别, 组装差异对象, 添加到更新队列diffQueue中
  _diff(diffQueue, nextChildrenElements) { // todo
    const parentNode = $(`[data-reactid="${this._rootNodeId}"]`)
    // 拿到之前的子节点的component类型对象的集合, 这个是在刚开始渲染时赋值的
    // 并对其进行flatten, 结果为一个key到child的map
    const prevChildren = flattenChildren(this._renderedChildren)
    // 生成新的子节点的component对象集合, 这里注意, 恢复用老的component对象
    const nextChildren = generateComponentChildren(prevChildren, nextChildrenElements)
    // 重新复制_renderedChildren, 使用最新的
    this._renderedChildren = []
    $.each(nextChildren, (key, child) => {
      this._renderedChildren.push(child)
    })

    let nextIndex = 0 // 代表到达的新的节点的index
    // 通过比较两个集合的差异, 组装差异节点添加到队列中
    for (const key in nextChildren) {
      if (!nextChildren.hasOwnProperty(key)) {
        continue
      }
      const prevChild = prevChildren && prevChildren[key]
      const nextChild = nextChildren[key]
      if (prevChild === nextChild) { // 相同的话, 说明是使用的同一个component, 所以我们需要做移动的操作
        diffQueue.push({
          type: UPDATE_TYPES.MOVE_EXISTING,
          parentId: this._rootNodeId,
          parentNode: parentNode,
          fromIndex: prevChild._mountIndex,
          toIndex: nextIndex,
        })
      } else { // 如果不相同, 说明是新增加的节点
        // 但是如果老的还存在, 就是element不同, 但是component一样
        // 我们需要把它对应的老的element删除
        if (prevChild) {
          // 添加差异对象, 类型: REMOVE_NODE
          diffQueue.push({
            type: UPDATE_TYPES.REMOVE_NODE,
            parentId: this._rootNodeId,
            parentNode: parentNode,
            fromIndex: prevChild._mountIndex,
            toIndex: null,
          })

          // 如果以前已经渲染过了, 记得先去掉以前所有的事件监听, 通过命名空间全部清除
          if (prevChild._rootNodeId) {
            $(document).undelegate('.' + prevChild._rootNodeId)
          }
        }

        // 新增加的节点, 也组装差异对象放到队列里
        // 添加差异对象, 类型: INSERT_MARKUP
        diffQueue.push({
          type: UPDATE_TYPES.INSERT_MARKUP,
          parentId: this._rootNodeId,
          parentNode: parentNode,
          fromIndex: null,
          toIndex: nextIndex,
          // 新增的节点, 多一个属性, 表示新节点的dom内容
          markup: nextChild.mountComponent(),
        })
      }
      // 更新mount的index
      nextChild._mountIndex = nextIndex
      nextIndex++
    }

    // 对于老的节点里有, 新的节点里没有的那些, 也全都删除掉
    for (const key in prevChildren) {
      if (prevChildren.hasOwnProperty(key) && !(nextChildren && nextChildren.hasOwnProperty(key))) {
        const prevChild = prevChildren[key]
        diffQueue.push({
          type: UPDATE_TYPES.REMOVE_NODE,
          parentId: this._rootNodeId,
          parentNode: parentNode,
          fromIndex: prevChild._mountIndex,
          toIndex: null,
        })
        // 如果以前已经渲染过了, 记得先去掉以前所有的事件监听
        if (prevChild._rootNodeId) {
          $(document).undelegate('.' + prevChild._rootNodeId)
        }
      }
    }
  }

  _patch(updates) { // todo
    const initialChildren = {}
    const deleteChildren = []
    updates.forEach(update => {
      if (update.type === UPDATE_TYPES.MOVE_EXISTING
        || update.type === UPDATE_TYPES.REMOVE_NODE) {
        const updatedIndex = update.fromIndex
        const updatedChild = $(update.parentNode.children().get(updatedIndex))
        const parentId = update.parentId

        // 所有需要更新的节点都保存下来, 方便后面使用
        initialChildren[parentId] = initialChildren[parentId] || []
        // 使用parentId作为简易命名空间
        initialChildren[parentId][updatedIndex] = updatedChild

        // 所有需要修改的节点先删除, 对于move的, 后面再重新插入到正确的位置即可
        deleteChildren.push(updatedChild)
      }
    })
    // 删除所有需要先删除的
    deleteChildren.forEach(child => $(child).remove())

    // 再遍历一次, 这次处理新增的节点, 还有修改的节点这里也要重新插入
    updates.forEach(update => {
      switch (update.type) {
        case UPDATE_TYPES.INSERT_MARKUP:
          insertChildAt(update.parentNode, $(update.markup), update.toIndex)
          break
        case UPDATE_TYPES.MOVE_EXISTING:
          insertChildAt(
            update.parentNode,
            initialChildren[update.parentId][update.fromIndex],
            update.toIndex)
          break
        case UPDATE_TYPES.REMOVE_NODE:
          // 什么也不做, 因为上面已经帮忙删除掉了
          break
      }
    })
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

  receiveComponent(nextElement, newState) {
    // 如果接受了新的element, 就使用新的element
    this._currentElement = nextElement || this._currentElement

    const inst = this._instance
    // 合并state
    const nextState = Object.assign({}, inst.state, newState)
    const nextProps = this._currentElement.props

    // 改写state // todo ??? 在这里更新state对吗, 是不是要等某个生命周期函数调用完了再更新state??
    inst.state = nextState

    // 如果有inst有shouldComponentUpdate并且返回false, 说明组件本身判断不需要更新, 就直接返回
    if (inst.shouldComponentUpdate
      && inst.shouldComponentUpdate(nextProps, nextState === false)) {
      return
    }

    // 生命周期管理, 如果有componentWillUpdate, 就调用, 表示开始要更新了
    if (inst.componentWillUpdate) {
      inst.componentWillUpdate(nextProps, nextState)
    }

    const prevComponentInstance = this._renderedComponent
    const prevRenderedElement = prevComponentInstance._currentElement
    // 重新执行render拿到对应的新的element
    const nextRenderedElement = this._instance.render()

    // 判断是需要更新还是直接就重新渲染
    // 注意这里的_shouldUpdateReactComponent和上面的不同, 这个是全局的方法 // todo
    if (_shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
      // 如果需要更新, 就继续调用子节点的receiveComponent方法, 传入新的element更新子节点
      prevComponentInstance.receiveComponent(nextRenderedElement)
      // 调用componentDidUpdate表示更新完成了
      if (inst.componentDidUpdate) {
        inst.componentDidUpdate()
      }
    } else { // 如果发现完全是不同的两种element, 那就干脆重新渲染了
      // 重新new一个对应的component
      this._renderedComponent = instantiateReactComponent(nextRenderedElement) // ???
      // 重新生成对应的元素内容
      const nextMarkup = this._renderedComponent.mountComponent(this._rootNodeId)
      // 替换整个节点
      $(`[data-reactid="${this._rootNodeId}"]`).replaceWith(nextMarkup)
    }
  }
}

class Component {
  constructor(props) {
    this.props = props
    this.state = null
  }

  setState(newState) {
    this._reactInternalInstance.receiveComponent(null, newState)
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

  Component: Component,
}
