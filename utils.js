/** 普通的children是一个数组，此方法把它转换成一个map, key就是element的key,
 如果是text节点或者element创建时并没有传入key,就直接用在数组里的index标识
 * @param componentChildren {Array}
 */
function flattenChildren(componentChildren) {
  const childrenMap = {}
  componentChildren.forEach((child, index)=> {
    let name = child && child._currentElement && child._currentElement.key ?
      child._currentElement.key : index.toString(36)
    childrenMap[name] = child
  })
  return childrenMap
}

/**
 * 主要用来生成子节点elements的component集合
 * 这边注意，有个判断逻辑，如果发现是更新，
 * 就会继续使用以前的componentInstance,调用对应的receiveComponent,
 * 如果是新的节点，就会重新生成一个新的componentInstance
 * */
function generateComponentChildren(prevChildren, nextChildrenElements = []) {
  let nextChildren = {}
  nextChildrenElements.forEach((element, index)=> {
    let name = element.key || index
    let prevChild = prevChildren && prevChildren[name]
    let prevElement = prevChild && prevChild._currentElement
    let nextElement = element

    // 调用_shouldUpdateReactComponent判断是否是更新
    if (_shouldUpdateReactComponent(prevElement, nextElement)) {
      // 更新的话直接递归调用子节点的receiveComponent就好了
      prevChild.receiveComponent(nextElement)
      // 然后继续使用老的component
      nextChildren[name] = prevChild
    } else {
      // 对于没有老的, 那就重新新增一个, 重新生成一个component
      let nextChildInstance = instantiateReactComponent(nextElement, null) // todo ?? 为什么要加null
      // 使用新的component
      nextChildren[name] = nextChildInstance
    }
  })
  return nextChildren
}

function _shouldUpdateReactComponent(prevElement, nextElement) {
  if (prevElement == null || nextElement == null)
    return false

  let prevType = typeof prevElement
  let nextType = typeof nextElement
  if (prevType === 'string' || prevType === 'number') {
    return nextType === 'string' || nextType === 'number'
  } else {
    return nextType === 'object'
      && prevElement.type === nextElement.type
      && prevElement.key === nextElement.key
  }
}
