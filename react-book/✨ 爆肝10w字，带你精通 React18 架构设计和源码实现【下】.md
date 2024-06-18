# ✨ 爆肝10w字，带你精通 React18 架构设计和源码实现【下】

> 文章源码地址：https://github.com/sunny-117/tiny-react
> 感谢掘友的鼓励与支持🌹🌹🌹，往期文章都在最后梳理出来了(●'◡'●)

# 源码启发-性能优化

## 性能优化策略之eagerState

在 React 中，有很多和性能优化相关的 API：

- shouldComponentUpdate
- PureComponent
- React.memo
- useMemo
- useCallback

实际上，开发者调用上面的 API，内部是在命中 React 的性能优化策略：

- eagerState
- bailout

```jsx
import { useState } from "react";

// 子组件
function Child() {
  console.log("child render");
  return <span>child</span>;
}

// 父组件
function App() {
  const [num, updateNum] = useState(0);
  console.log("App render", num);

  return (
    <div onClick={() => updateNum(1)}>
      <Child />
    </div>
  );
}
```

在上面的代码中，渲染结果如下：

首次渲染：

```js
App render 0
child render
```

第一次点击

```js
App render 1
child render
```

第二次点击

```js
App render 1
```

第三次以及之后的点击

不会有打印



上面的这个例子实际上就涉及到了我们所提到的 React 内部的两种性能优化策略：

- 在第二次打印的时候，并没有打印 child render，此时实际上是命中了 bailout 策略。命中该策略的组件的子组件会跳过 reconcile 过程，也就是说子组件不会进入 render 阶段。
- 后面的第三次以及之后的点击，没有任何输入，说明 App、Child 都没有进入 render 阶段，此时命中的就是 eagerState 策略，这是一种发生于触发状态更新时的优化策略，如果命中了该策略，此次更新不会进入 schedule 阶段，更不会进入 render 阶段。



### eagerState 策略

该策略的逻辑其实是很简单：如果某个状态更新前后没有变化，那么就可以跳过后续的更新流程。

state 是基于 update 计算出来的，计算过程发生在 render 的 beginWork，而 eagerState 则是将计算过程提前到了 shcedule 之前执行。

该策略有一个前提条件，那就是当前的 FiberNode 不存在待执行的更新，因为如果不存在待执行的更新，那么当前的更新就是第一个更新，那么计算出来的 state 即便有变化也可以作为后续更新的基础 state 来使用。

例如，在使用 useState 触发更新的时候，对应的 dispatchSetState 逻辑如下：

```js
if (
  fiber.lanes === NoLanes &&
  (alternate === null || alternate.lanes === NoLanes)
) {
  // 队列当前为空，这意味着我们可以在进入渲染阶段之前急切地计算下一个状态。 如果新状态与当前状态相同，我们或许可以完全摆脱困境。
  const lastRenderedReducer = queue.lastRenderedReducer;
  if (lastRenderedReducer !== null) {
    let prevDispatcher;
    try {
      const currentState = queue.lastRenderedState; // 也就是 memoizedState
      const eagerState = lastRenderedReducer(currentState, action); // 基于 action 提前计算 state
      // 将急切计算的状态和用于计算它的缩减器存储在更新对象上。 
      // 如果在我们进入渲染阶段时 reducer 没有改变，那么可以使用 eager 状态而无需再次调用 reducer。
      update.hasEagerState = true; // 标记该 update 存在 eagerState
      update.eagerState = eagerState; // 存储 eagerState 的值
      if (is(eagerState, currentState)) {
        // ...
        return;
      }
    } catch (error) {
      // ...
    } finally {
      // ...
    }
  }
}
```

在上面的代码中，首先通过 lastRenderedReducer 来提前计算 state，计算完成后在当前的 update 上面进行标记，之后使用 is(eagerState, currentState) 判断更新后的状态是否有变化，如果进入 if，说明更新前后的状态没有变化，此时就会命中 eagerState 策略，不会进入 schedule 阶段。

即便不为 true，由于当前的更新是该 FiberNode 的第一个更新，因此可以作为后续更新的基础 state，因此这就是为什么在 FC 组件类型的 update 里面有 hasEagerState 以及 eagerState 字段的原因：

```js
const update = {
  hasEagerState: false,
  eagerState: null,
  // ...
}
```



在上面的示例中，比较奇怪的是第二次点击，在第二次点击之前，num 已经为 1 了，但是父组件仍然重新渲染了一次，为什么这种情况没有命中 eagerState 策略？

FiberNode 分为 current 和 wip 两种。

在上面的判断中，实际上会对 current 和 wip 都进行判断，判断的条件为两个 Fiber.lanes 必须要为 NoLanes

```js
if (
  fiber.lanes === NoLanes &&
  (alternate === null || alternate.lanes === NoLanes)
){
  // ....
}
```

对于第一次更新，当 beginWork 开始前，current.lanes 和 wip.lanes 都不是 NoLanes。当 beginWork 执行后， wip.lanes 会被重置为 NoLanes，但是 current.lanes 并不会，current 和 wip 会在 commit 阶段之后才进行互换，这就是为什么第二次没有命中 eagerState 的原因。



那么为什么后面的点击又命中了呢？

虽然上一次点击没有命中 eagerState 策略，但是命中了 bailout 策略，对于命中了 bailout 策略的 FC，会执行 bailoutHooks 方法：

```js
function bailoutHooks(
  current: Fiber,
  workInProgress: Fiber,
  lanes: Lanes,
) {
  workInProgress.updateQueue = current.updateQueue;
  // ...
  current.lanes = removeLanes(current.lanes, lanes);
}
```

在执行 bailoutHooks 方法的时候，最后一句会将当前 FiberNode 的 lanes 移除，因此当这一轮更新完成后，current.lanes 和 wip.lanes 就均为 NoLanes，所以在后续的点击中就会命中 eagerState 策略。



### 总结

> 题目：谈一谈 React 中的 eagerState 策略是什么？
>
> 参考答案：
>
> 在 React 内部，性能优化策略可以分为：
>
> - eagerState 策略
> - bailout 策略
>
> eagerState 的核心逻辑是如果某个状态更新前后没有变化，则可以跳过后续的更新流程。该策略将状态的计算提前到了 schedule 阶段之前。当有 FiberNode 命中 eagerState 策略后，就不会再进入 schedule 阶段，直接使用上一次的状态。
>
> 该策略有一个前提条件，那就是当前的 FiberNode 不存在待执行的更新，因为如果不存在待执行的更新，当前的更新就是第一个更新，计算出来的 state 即便不能命中 eagerState，也能够在后面作为基础 state 来使用，这就是为什么 FC 所使用的 Update 数据中有 hasEagerState 以及 eagerState 字段的原因。


## 性能优化策略之bailout

前面我们学习 beginWork 的时候，我们知道 beginWork 的作用主要是生成 wipFiberNode 的子 FiberNode，要达到这个目录存在两种方式：

- 通过 reconcile 流程生成子 FiberNode
- 通过命中 bailout 策略来复用子 FiberNode

在前面我们讲过，所有的变化都是由“自变量”的改变造成的，在 React 中自变量：

- state
- props
- context

因此是否命中 bailout 主要也是围绕这三个变量展开的，整体的工作流程如下：

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-03-09-010841.png" alt="image-20230309090841270" style="zoom:50%;" />

从上图可以看出，bailout 是否命中发生在 update 阶段，在进入 beginWork 后，会有两次是否命中 bailout 策略的相关判断



### 第一次判断

第一次判断发生在确定了是 update 后，立马就会进行是否能够复用的判断：

- oldProps 全等于 newProps
- Legacy Context 没有变化
- FiberNode.type 没有变化
- 当前 FiberNode 没有更新发生



**oldProps 全等于 newProps**

注意这里是做的一个全等比较。组件在 render 之后，拿到的是一个 React 元素，会针对 React 元素的 props 进行一个全等比较。但是由于每一次组件 render 的时候，会生成一个全新的对象引用，因此 oldProps 和 newProps 并不会全等，此时是没有办法命中 bailout。

只有当父 FiberNode 命中 bailout 策略时，复用子 FiberNode，在子 FiberNode 的 beginWork 中，oldProps 才有可能和 newProps 全等。

> 备注：视频中这里讲解有误，不是针对 props 属性每一项进行比较，而是针对 props 对象进行全等比较。上面的笔记内容已修改。



**Legacy Context 没有变化**

Legacy Context指的是旧的 ContextAPI，ContextAPI重构过一次，之所以重构，就是和 bailout策略相关。



**FiberNode.type 没有变化**

这里所指的 FiberNode.type 没有变化，指的是不能有例如从 div 变为 p 这种变化。

```jsx
function App(){
  const Child = () => <div>child</div>
  return <Child/>
}
```

在上面的代码中，我们在 App 组件中定义了 Child 组件，那么 App 每次 render 之后都会创建新的 Child 的引用，因此对于 Child 来讲，FiberNode.type 始终是变化的，无法命中 bailout 策略。

因此不要在组件内部再定义组件，以免无法命中优化策略。



**当前 FiberNode 没有更新发生**

当前 FiberNode 没有发生更新，则意味着 state 没有发生变化。

例如在源码中经常会存在是否有更新的检查：

```js
function checkScheduledUpdateOrContext(current, renderLanes) {
  // 在执行 bailout 之前，我们必须检查是否有待处理的更新或 context。
  const updateLanes = current.lanes;
  if (includesSomeLane(updateLanes, renderLanes)) {
    // 存在更新
    return true;
  }
  
  //...
  
  // 不存在更新
  return false;
}
```



**当以上条件都满足的时候**，会命中 bailout 策略，命中该策略后，会执行 bailoutOnAlreadyFinishedWork 方法，在该方法中，会进一步的判断优化程序，根据优化程度来决定是整颗子树都命中 bailout 还是复用子树的 FiberNode

```js
function bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes) {
  
  // ...

  if (!includesSomeLane(renderLanes, workInProgress.childLanes)) {
    // ...
    // 整颗子树都命中 bailout 策略
		return null;
  }

  // 该 FiberNode 没有命中 bailout，但它的子树命中了。克隆子 FiberNode 并继续
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
```

通过 wipFiberNode.childLanes 就可以快速的排查当前的 FiberNode 的整颗子树是否存在更新，如果不存在，直接跳过整颗子树的 beginWork。

这其实也解释了为什么每次 React 更新都会生成一颗完整的 FiberTree 但是性能上并不差的原因。



### 第二次判断

如果第一次没有命中 bailout 策略，则会根据 tag 的不同进入不同的处理逻辑，之后还会再进行第二次的判断。

第二次判断的时候会有两种命中的可能：

- 开发者使用了性能优化 API
- 虽然有更新，但是 state 没有变化



**开发者使用了性能优化 API**

在第一次判断的时候，默认是对 props 进行全等比较，要满足这个条件实际上是比较困难的，性能优化 API 的工作原理主要就是改写这个判断条件。

比如 React.memo，通过该 API 创建的 FC 对应的 FiberNode.tag 为 MemoComponent，在 beginWork 中对应的处理逻辑如下：

```js
const hasScheduledUpdateOrContext = checkScheduledUpdateOrContext(
  current,
  renderLanes,
);
if (!hasScheduledUpdateOrContext) {
  const prevProps = currentChild.memoizedProps;
  // 比较函数，默认进行浅比较
  let compare = Component.compare;
  compare = compare !== null ? compare : shallowEqual;
  if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
    // 如果 props 经比较未变化，且 ref 不变，则命中 bailout 策略
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }
}
```

因此是否命中 bailout 策略的条件就变成了如下三个：

- 不存在更新
- 经过比较（浅比较）后 props 没有变化
- ref 没有发生改变

如果同时满足上面这三个条件，就会命中 bailout 策略，执行 bailoutOnAlreadyFinishedWork 方法。相较于第一次判断，第二次判断 props 采用的是浅比较进行判断，因此能够更加容易命中 bailout



例如再来看一个例子，比如 ClassComponent 的优化手段经常会涉及到 PureComponent 或者 shouldComponentUpdate，这两个 API 实际上背后也是在优化命中bailout 策略的方式

在 ClassComponnet 的 beginWork 方法中，有如下的代码：

```js
if(!shouldUpdate && !didCaptureError){
  // 省略代码
  return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
}
```

shouldUpdate 变量受 checkShouldComponentUpdate 方法的影响：

```js
function checkShouldComponentUpdate(
  workInProgress,
  ctor,
  oldProps,
  newProps,
  oldState,
  newState,
  nextContext,
) {
  // ClassComponent 实例
  const instance = workInProgress.stateNode;
  if (typeof instance.shouldComponentUpdate === 'function') {
    let shouldUpdate = instance.shouldComponentUpdate(
      newProps,
      newState,
      nextContext,
    );
    
		// shouldComponentUpdate 执行后的返回值作为 shouldUpdate
    return shouldUpdate;
  }

  // 如果是 PureComponent
  if (ctor.prototype && ctor.prototype.isPureReactComponent) {
    // 进行浅比较
    return (
      !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
    );
  }

  return true;
}
```

通过上面的代码中我们可以看出，PureComponent 通过浅比较来决定shouldUpdate的值，而shouldUpdate的值又决定了是否能够命中 bailout 策略。



**虽然有更新，但是 state 没有变化**

在第一次进行判断的时候，其中有一个条件是当前的 FiberNode 没有更新发生，没有更新就意味着 state 没有改变。但是还有一种情况，那就是有更新，但是更新前后计算出来的 state 仍然没有变化，此时就也会命中 bailout 策略。

例如在 FC 的 beginWork 中，有如下一段逻辑：

```js
function updateFunctionComponent(
  current,
  workInProgress,
  Component,
  nextProps: any,
  renderLanes,
) {
  //...

  if (current !== null && !didReceiveUpdate) {
    // 命中 bailout 策略
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // ...

  // 进入 reconcile 流程
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}
```

在上面的代码中，是否能够命中 bailout 策略取决于 didReceiveUpdate，接下来我们来看一下这个值是如何确定的：

```js
// updateReducer 内部在计算新的状态时
if (!is(newState, hook.memoizedState)) {
  markWorkInProgressReceivedUpdate();
}

function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true;
}
```



### 总结

> 题目：谈一谈 React 中的 bailout 策略
>
> 参考答案：
>
> 在 beginWork 中，会根据 wip FiberNode 生成对应的子 FiberNode，此时会有两次“是否命中 bailout策略”的相关判断。
>
> - 第一次判断
>
>   - oldProps 全等于 newProps
>   - Legacy Context 没有变化
>   - FiberNode.type 没有变化
>   - 当前 FiberNode 没有更新发生
>
>   **当以上条件都满足时**会命中 bailout 策略，之后会执行 bailoutOnAlreadyFinishedWork 方法，该方法会进一步判断能够优化到何种程度。
>
>   通过 wip.childLanes 可以快速排查“当前 FiberNode 的整颗子树中是否存在更新”，如果不存在，则可以跳过整个子树的 beginWork。这其实也是为什么 React 每次更新都要生成一棵完整的 Fiebr Tree 但是性能并不差的原因。
>
> - 第二次判断
>
>   - 开发者使用了性能优化 API，此时要求当前的 FiberNode 要同时满足：
>     - 不存在更新
>     - 经过比较（默认浅比较）后 props 未变化
>     - ref 不变
>   - 虽然有更新，但是 state 没有变化


## bailout和ContextAPI

> 思考：为什么要重构 ContextAPI，旧版的 ContextAPI 有什么问题？

ContextAPI 经历过一次重构，重构的原因和 bailout 策略相关。

在旧版的 ContextAPI 中，数据是保存在栈里面的。

在 beginWork 中，context 会不断的入栈（context栈），这意味着 context consumer 可以通过这个 context 栈来找到对应的 context 数据。在 completeWork 中，context 会不断的出栈。

这种入栈出栈的模式，刚好对应了 reconcile 的流程以及一般的 bailout 策略。

那么旧版的 ContextAPI 存在什么缺陷呢？

但是针对“跳过整颗子树的 beginWork”这种程度的 bailout 策略，被跳过的子树就不会再经历 context 入栈出栈的过程，因此如果使用旧的 ContextAPI ，即使此时 context 里面的数据发生了变化，但是因为子树命中了 bailout 策略被整颗跳过了，所以子树中的 context consumer 就不会响应更新。

例如，有如下的代码：

```jsx
import React, { useState,useContext } from "react";

// 创建了一个 context 上下文
const MyContext = React.createContext(0);

const { Provider } = MyContext;

function NumProvider({children}) {
  // 在 NumProvider 中维护了一个数据
  const [num, add] = useState(0);

  return (
    // 将 num 数据放入到了上下文中
    <Provider value={num}>
      <button onClick={() => add(num + 1)}>add</button>
      {children}
    </Provider>
  );
}

class Middle extends React.Component{
  shouldComponentUpdate(){
    // 直接返回 false，意味着会命中 bailout 策略
    return false;
  }
  render(){
    return <Child/>;
  }
}

function Child(){
  // 从 context 上下文中获取数据，然后渲染
  const num = useContext(MyContext);
  // 也就是说，最终 Child 组件所渲染的数据不是自身组件，而是来自于上下文
  // 其中它的父组件会命中 bailout 策略
  return <p>{num}</p>
}

// 父组件
function App() {
  return (
    <NumProvider>
      <Middle />
    </NumProvider>
  );
}

export default App;
```

在上面的示例中，App 是挂载的组件，NumProvider 是 context Provider（上下文的提供者），Child 是 context Consumer（上下文的消费者）。在 App 和 Child 之间有一个 Middle，我们在 Middle 组件直接使用了性能优化 API，设置 shouldComponentUpdate 为 false，使其直接命中 bailout 策略。

当点击 button 之后，num 会增加，但是如果是在旧版的 ContextAPI 中，这段代码是会存在缺陷的，在旧版 ContextAPI 中，子树的 beginWork 都会被跳过，这意味着 Child 组件的 beginWork 也会被跳过，表现出来的现象就是点击 button 后 num 不变。



那么新版的 ContextAPI 是如何修复的呢？

当 beginWork 进行到 context privider 的时候，会有如下的处理逻辑：

```js
if(objectIs(oldValue, newValue)){
  // context value 未发生变化
  if(oldProps.children === newProps.children && !hasContextChanged()) {
    // 命中 bailout 策略
    return bailoutOnAlreadyFinnishedWork(current, workInProgress, renderLanes);
  }
} else {
  // context value 变化，向下寻找 Consumer，标记更新
  propageteContextChange(workInProgress, context, renderLanes);
}
```

在上面的代码中，首先会判断 context value 是否有变化，当 context value 发生变化时，beginWork 会从 Provider 立刻向下开启一次深度优先遍历，目的就是为了寻找 context consumer，如果一旦找到 context consumer，就对为对应的 FiberNode.lanes 上面附加一个 renderLanes，对应的相关逻辑如下：

```js
// Context Consumer lanes 附加上 renderLanes
fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
const alternate = fiber.alternate;

if(alternate !== null){
  alternate.lanes = mergeLanes(alternate.lanes, renderLanes);
}
// 从 Context Consumer 向上遍历
scheduleWorkOnParentPath(fiber.return, renderLanes);
```

上面的 scheduleWorkOnParentPath 方法的作用是从 context consumer 向上遍历，依次为祖先的 FiberNode.childLanes 附加 renderLanes。

因此，我们来总结一下，当 context value 发生变化的时候，beginWork 从 Provider 开始向下遍历，找到 context consumer 之后为当前的 FiberNode 标记一个 renderLanes，再从 context consumer 向上遍历，为祖先的 FiberNode.childLanes 标记一个 renderLanes。

注意无论是向下遍历寻找 context consumer 还是从 context consumer 向上遍历修改 childLanes，这个都发生在 Provider 的 beginWork 中。

因此，上述的流程完成后，虽然 Provider 命中了 bailout 策略，但是由于流程中 childLanes 已经被修改了，因此就不会命中“跳过整颗子树的beginWork”的逻辑，相关代码如下：

```js
function bailoutOnAlreadyFinishedWork(
	 current,
   workInProgress,
   renderLanes
){
     //...
    
     // 不会命中该逻辑
     if(!includesSomeLane(renderLanes, workInProgress.childLanes)){
       // 整颗子树都命中 bailout 策略
       return null;
     }
     
     //...
}
```

通过上面的代码我们可以看出，“如果子树深处存在 context consumer”，即使子树的根 FiberNode 命中了 bailout 策略，由于存在 childLanes 的标记，因此不会完全跳过子树的 beginWork 过程，所以新版的 ContextAPI 能实现更新，解决了旧版 ContextAPI 无法更新的问题。



### 总结

> 题目：为什么要重构 ContextAPI，旧版的 ContextAPI 有什么问题？
>
> 参考答案：
>
> 旧版的 ContextAPI 存在一些缺陷。
>
> context 中的数据是保存在栈里面的。在 beginWork 中，context 会不断的入栈，所以 context Consumer 可以通过 context 栈向上找到对应的 context value，在 completeWork 中，context 会不断出栈。
>
> 这种入栈出栈的模式刚好可以用来应对 reconcile 流程以及一般的 bailout 策略。
>
> 但是，对于“跳过整颗子树的 beginWork”这种程度的 bailout 策略，被跳过的子树就不会再经历 context 的入栈和出栈过程，因此在使用旧的ContextAPI时，即使 context里面的数据发生了变化，但只要子树命中了bailout策略被跳过了，那么子树中的 Consumer 就不会响应更新。
>
> 新版的 ContextAPI 当 context value 发生变化时，beginWork 会从 Provider 立刻向下开启一次深度优先遍历，目的是寻找 Context Consumer。Context Consumer 找到后，会为其对应的 FiberNode.lanes 附加 renderLanes，再从 context consumer 向上遍历，为祖先的 FiberNode.childLanes 标记一个 renderLanes。因此如果子树深处存在 Context Consumer，即使子树的根 FiberNode 命中 bailout 策略，也不会完全跳过子树的 beginWork 流程 。


## 性能优化对日常开发启示

在前面我们已经学习了 React 中内置的性能优化相关策略，包括：

- eagerState 策略
- bailout 策略

其中 eagerState 策略需要满足的条件是比较苛刻的，开发时不必强求。但是作为 React 开发者，应该追求写出满足 bailout 策略的组件。

当我们聊到性能优化的时候，常见的想法就是使用性能优化相关的 API，但是当我们深入学习 bailout 策略的原理后，我们就会知道，即使不使用性能优化 API，只要满足一定条件，也能命中 bailout 策略。

我们来看一个例子：

```jsx
import React, { useState } from "react";

function ExpensiveCom() {
  const now = performance.now();
  while (performance.now() - now < 200) {}
  return <p>耗时的组件</p>;
}

function App() {
  const [num, updateNum] = useState(0);

  return (
    <>
      <input value={num} onChange={(e) => updateNum(e.target.value)} />
      <p>num is {num}</p>
      <ExpensiveCom />
    </>
  );
}

export default App;
```

在上面的例子中，App 是挂载的组件，由于 ExpensiveCom 在 render 时会执行耗时的操作，因此在 input 输入框中输入内容时，会发生明显的卡顿。

究其原因，是因为 ExpensiveCom 组件并没有命中 bailout 策略。

那么为什么该组件没有命中 bailout 策略呢？

在 App 组件中，会触发 state 更新（num 变化），所以 App 是肯定不会命中 bailout 策略的，而在 ExpensiveCom 中判断是否能够命中 bailout 策略时，有一条是 oldProps === newProps，由于 App 每次都是重新 render 的，所以子组件的这个条件并不会满足。



为了使 ExpensiveCom 命中 bailout 策略，咱们就需要从 App 入手，将 num 与 num 相关的视图部分进行一个分离，形成一个独立的组件，如下：

```jsx
import React, { useState } from "react";

function ExpensiveCom() {
  const now = performance.now();
  while (performance.now() - now < 200) {}
  return <p>耗时的组件</p>;
}

function Input() {
  const [num, updateNum] = useState(0);

  return (
    <div>
      <input value={num} onChange={(e) => updateNum(e.target.value)} />
      <p>num is {num}</p>
    </div>
  );
}

function App() {
  return (
    <>
      <Input/>
      <ExpensiveCom />
    </>
  );
}

export default App;

```

在上面的代码中，我们将 App 中的 state 变化调整到了 Input 组件中，这样修改之后对于 App 来讲就不存在 state 的变化了，那么 App 组件就会命中 bailout 策略，从而让 ExpensiveCom 组件也命中 bailout 策略。

命中 bailout 策略后的 ExpensiveCom 组件就不会再执行耗时的 render。



现在我们考虑另一种情况，在如下的组件中，div 的 title 属性依赖 num，无法像上面例子中进行分离，如下：

```jsx
import React, { useState } from "react";

function ExpensiveCom() {
  const now = performance.now();
  while (performance.now() - now < 200) {}
  return <p>耗时的组件</p>;
}


function App() {
  const [num, updateNum] = useState(0);

  return (
    <div title={num}>
      <input value={num} onChange={(e) => updateNum(e.target.value)} />
      <p>num is {num}</p>
      <ExpensiveCom />
    </div>
  );
}

export default App;
```

那么此时我们可以通过 children 来达到分离的目的，如下：

```jsx
import React, { useState } from "react";

function ExpensiveCom() {
  const now = performance.now();
  while (performance.now() - now < 200) {}
  return <p>耗时的组件</p>;
}

function Counter({ children }) {
  const [num, updateNum] = useState(0);
  return (
    <div title={num}>
      <input value={num} onChange={(e) => updateNum(e.target.value)} />
      <p>num is {num}</p>
      {children}
    </div>
  );
}

function App() {
  // 在该 App 当中就没有维护数据了，也就不存在 state 的变化
  return (
    <Counter>
      <ExpensiveCom/>
    </Counter>
  );
}

export default App;

```

不管采用哪种方式，其本质就是将**可变部分**与**不可变部分**进行分离，**使不变的部分能够命中 bailout 策略**。在日常开发中，即使不使用性能优化 API，合理的组件结构也能为性能助力。



在默认情况下，FiberNode 要命中 bailout 策略还需要满足 oldProps === newProps。这意味着默认情况下，如果父 FiberNode 没有命中策略，子 FiberNode 就不会命中策略，孙 FiberNode 以及子树中的其他 FiberNode 都不会命中策略。所以当我们编写好符合性能优化条件的组件后，还需要注意组件对应子树的根节点。

如果根节点是应用的根节点（HostRootFiber），那么默认情况下 oldProps === newProps，挂载其下的符合性能优化条件的组件能够命中bailout策略。

如果根节点是其他组件，则此时需要使用性能优化 API，将命中 bailout 策略其中的一个条件从“满足 oldProps === newProps” 变为“浅比较 oldProps 与 newProps”。只有根节点命中 bailout 策略，挂载在它之下的符合性能优化条件的组件才能命中 bailout 策略。



如果将性能优化比作治病的话，那么编写符合性能优化条件的组件就相当于药方，而使用性能优化 API 的组件则相当于药引子。单纯使用药方可能起不到预期的疗效（不满足 oldProps === newProps），单纯的使用药引子（仅使用性能优化 API）也会事倍功半。只有足量的药方（满足性能优化条件的组件子树）加上恰到好处的药引子（在子树根节点这样的关键位置使用性能优化API）才能药到病除。


# React 的事件机制


在 React 中，有一套自己的事件系统，如果说 React 中的 FiberTree 这个数据结构是用来描述 UI 的，那么 React 里面的事件系统就是用来描述 FiberTree 和 UI 之间的的交互的。

对于 ReactDOM 宿主环境，这套事件系统由两个部分：

- 合成事件对象

SyntheticEvent （合成事件对象）这个是对浏览器原生事件对象的一层封装，兼容了主流的浏览器，同时拥有和浏览器原生事件相同的 API，例如 stopPropagation 和 preventDefault。SyntheticEvent 存在的目的就是**为了消除不同浏览器在事件对象上面的差异。**


- 模拟实现事件传播机制

利用事件委托的原理，React 会基于 FiberTree 来实现了事件的捕获、目标以及冒泡的过程（就类似于原生 DOM 的事件传递过程），并且在自己实现的这一套事件传播机制中还**加入了许多新的特性**，比如：

- 不同的事件对应了不同的优先级
- 定制事件名
  - 比如在 React 中统一采用 onXXX 的驼峰写法来绑定事件
- 定制事件的行为
  - 例如 onChange 的默认行为与原生的 oninput 是相同



React 事件系统需要考虑到很多边界情况，因此代码量是非常大的，我们这里通过书写一个简易版的事件系统来学习 React 事件系统的原理。

假设，现在我们有如下这一段 JSX 代码：

```jsx
const jsx = (
  <div onClick={(e) => console.log("click div")}>
    <h3>你好</h3>
    <button
      onClick={(e) => {
        // e.stopPropagation();
        console.log("click button");
      }}
    >
      点击
    </button>
  </div>
);
```

在上面的代码中，我们为外层的 div 以及内部的 button 都绑定了点击事件，默认情况下，点击 button 会打印出 click button、click div，如果打开 e.stopPropagation( )，那么就会阻止事件冒泡，只打印出 click button。

可以看出，React 内部的事件系统实现了“模拟实现事件传播机制”。

接下来我们自己来写一套简易版事件系统，绑定事件的方式改为 bindXXXX



## 实现 SyntheticEvent

SyntheticEvent 指的是合成事件对象，在 React 中的 SyntheticEvent 会包含很多的属性和方法，这里我们出于演示的目的，我们只实现一个阻止冒泡

```js
/**
 * 合成事件对象类
 */
class SyntheticEvent {
  constructor(e) {
    // 保存原生的事件对象
    this.nativeEvent = e;
  }
  // 合成事件对象需要提供一个和原生 DOM 同名的阻止冒泡的方法
  stopPropagation() {
    // 当开发者调用 stopPropagation 方法，将该合成事件对象的 _stopPropagation 设置为 true
    this._stopPropagation = true;
    if (this.nativeEvent.stopPropagation) {
      // 调用原生事件对象的 stopPropagation 方法来阻止冒泡
      this.nativeEvent.stopPropagation();
    }
  }
}
```

在上面的代码中，我们创建了一个 SyntheticEvent 类，这个类可以用来创建合成事件对象。内部保存了原生的事件对象，还提供了一个和原生 DOM 的事件对象同名的阻止冒泡的方法。



## 实现事件的传播机制

对于可以冒泡的事件，整个事件的传播机制实现步骤如下：

- 在根元素绑定“事件类型对应的事件回调”，所有子孙元素触发该类事件时最终会委托给根元素的事件回调函数来进行处理
- 寻找触发事件的 DOM 元素，找到对应的 FiberNode
- 收集从当前的 FiberNode 到 HostRootFiber 之间所有注册了该事件的回调函数
- 反向遍历并执行一遍收集的所有的回调函数（模拟捕获阶段的实现）
- 正向遍历并执行一遍收集的所有的回调函数（模拟冒泡阶段的实现）

首先我们通过 addEvent 来给根元素绑定事件，目前是为了使用事件委托

```js
/**
 * 该方法用于给根元素绑定事件
 * @param {*} container 根元素
 * @param {*} type 事件类型
 */
export const addEvent = (container, type) => {
  container.addEventListener(type, (e) => {
    // 进行事件的派发
    dispatchEvent(e, type.toUpperCase());
  });
};
```

接下来在入口中通过调用 addEvent 来绑定事件，如下：

```js
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(jsx);
// 进行根元素的事件绑定，换句话说，就是使用我们自己的事件系统
addEvent(document.getElementById("root"), "click");
```

在 addEvent 里面，调用 dispatchEvent 做事件的派发：

```js
/**
 *
 * @param {*} e 原生的事件对象
 * @param {*} type 事件类型，已经全部转为了大写，比如这里传递过来的是 CLICK
 */
const dispatchEvent = (e, type) => {
  // 实例化一个合成事件对象
  const se = new SyntheticEvent(e);
  // 拿到触发事件的元素
  const ele = e.target;
  let fiber;
  // 通过 DOM 元素找到对应的 FiberNode
  for (let prop in ele) {
    if (prop.toLocaleLowerCase().includes("fiber")) {
      fiber = ele[prop];
    }
  }
  // 找到对应的 fiberNode 之后，接下来我们需要收集路径中该事件类型所对应的所有的回调函数
  const paths = collectPaths(type, fiber);
  // 模拟捕获的实现
  triggerEventFlow(paths, type + "CAPTURE", se);
  // 模拟冒泡的实现
  // 首先需要判断是否阻止了冒泡，如果没有，那么我们只需要将 paths 进行反向再遍历执行一次即可
  if(!se._stopPropagation){
    triggerEventFlow(paths.reverse(), type, se);
  }
};
```

dispatchEvent 方法对应有如下的步骤：

- 实例化一个合成事件对象
- 找到对应的 FiberNode
- 收集从当前的 FiberNode 一直往上所有的该事件类型的回调函数
- 模拟捕获的实现
- 模拟冒泡的实现



## 收集路径中对应的事件处理函数

```js
/**
 * 该方法用于收集路径中所有 type 类型的事件回调函数
 * @param {*} type 事件类型
 * @param {*} begin FiberNode
 * @returns
 * [{
 *  CLICK : function(){...}
 * },{
 *  CLICK : function(){...}
 * }]
 */
const collectPaths = (type, begin) => {
  const paths = []; // 存放收集到所有的事件回调函数
  // 如果不是 HostRootFiber，就一直往上遍历
  while (begin.tag !== 3) {
    const { memoizedProps, tag } = begin;
    // 如果 tag 对应的值为 5，说明是 DOM 元素对应的 FiberNode
    if (tag === 5) {
      const eventName = "bind" + type; // bindCLICK
      // 接下来我们来看当前的节点是否有绑定事件
      if (memoizedProps && Object.keys(memoizedProps).includes(eventName)) {
        // 如果进入该 if，说明当前这个节点绑定了对应类型的事件
        // 需要进行收集，收集到 paths 数组里面
        const pathNode = {};
        pathNode[type] = memoizedProps[eventName];
        paths.push(pathNode);
      }
      begin = begin.return;
    }
  }
  return paths;
};
```

实现的思路就是从当前的 FiberNode 一直向上遍历，直到 HostRootFiber，收集遍历过程中 FiberNode.memoizedProps 属性所保存的对应的事件处理函数。

最终返回的 paths 数组保存的结构大致如下：

```js
[{
   CLICK : function(){...}
  },{
   CLICK : function(){...}
}]
```



## 捕获和冒泡的实现

由于我们是从目标元素的 FiberNode 向上遍历的，因此收集到的顺序：

 [  目标元素的事件回调，某个祖先元素的事件回调，某个更上层的祖先元素的事件回调 ]

因此要模拟捕获阶段的实现，我们就需要从后往前进行遍历并执行：

```js
/**
 *
 * @param {*} paths 收集到的事件回调函数的数组
 * @param {*} type 事件类型
 * @param {*} se 合成事件对象
 */
const triggerEventFlow = (paths, type, se) => {
  // 挨着挨着遍历这个数组，执行回调函数即可
  // 模拟捕获阶段的实现，所以需要从后往前遍历数组并执行回调
  for (let i = paths.length; i--; ) {
    const pathNode = paths[i];
    const callback = pathNode[type];
    if (callback) {
      // 存在回调函数，执行该回调
      callback.call(null, se);
    }
    if (se._stopPropagation) {
      // 说明在当前的事件回调函数中，开发者阻止继续往上冒泡
      break;
    }
  }
};
```

在执行事件的回调的时候，每一次执行需要检验 _stopPropagation 属性是否为 true，如果为true，说明当前的事件回调函数中阻止了事件冒泡，因此我们应当停止后续的遍历。

如果是模拟冒泡阶段，只需要将 paths 进行反向再遍历一次并执行即可：

```js
// 模拟冒泡的实现
// 首先需要判断是否阻止了冒泡，如果没有，那么我们只需要将 paths 进行反向再遍历执行一次即可
if(!se._stopPropagation){
  triggerEventFlow(paths.reverse(), type, se);
}
```



至此，我们就实现了一个简易版的 React 事件系统。



## 总结

> 题目：简述一下 React 中的事件是如何处理的？
>
> 参考答案：
>
> 在 React 中，有一套自己的事件系统，如果说 React 用 FiberTree 这一数据结构是用来描述 UI 的话，那么事件系统则是基于 FiberTree 来描述和 UI 之间的交互。
>
> 对于 ReactDOM 宿主环境，这套事件系统由两个部分组成：
>
> （1）SyntheticEvent（合成事件对象）
>
> SyntheticEvent 是对浏览器原生事件对象的一层封装，兼容主流浏览器，同时拥有与浏览器原生事件相同的 API，例如 stopPropagation 和 preventDefault。SyntheticEvent 存在的目的是为了消除不同浏览器在 “事件对象” 间的差异。
>
> （2）模拟实现事件传播机制
>
> 利用事件委托的原理，React 基于 FiberTree 实现了事件的捕获、目标、冒泡的流程（类似于原生事件在 DOM 元素中传递的流程），并且在这套事件传播机制中加入了许多新的特性，例如：
>
> - 不同事件对应了不同的优先级
> - 定制事件名
>  - 例如事件统一采用如 “onXXX” 的驼峰写法
> - 定制事件行为
>  - 例如 onChange 的默认行为与原生 oninput 相同





# React 中的位运算

## 位运算的基础知识

所谓二进制，指的就是以二为底的一种计数方式。

| 十进制   |  0   |  1   |  2   |  3   |  4   |  5   |  6   |  7   |  8   |  9   |  10  |  11  |  12  |  13  |  14  |  15  |
| -------- | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
| 二进制   | 0000 | 0001 | 0010 | 0011 | 0100 | 0101 | 0110 | 0111 | 1000 | 1001 | 1010 | 1011 | 1100 | 1101 | 1110 | 1111 |
| 八进制   |  0   |  1   |  2   |  3   |  4   |  5   |  6   |  7   |  10  |  11  |  12  |  13  |  14  |  15  |  16  |  17  |
| 十六进制 |  0   |  1   |  2   |  3   |  4   |  5   |  6   |  7   |  8   |  9   |  A   |  B   |  C   |  D   |  E   |  F   |

我们经常会使用二进制来进行计算，基于二进制的位运算能够很方便的表达“增、删、查、改”。

例如一个后台管理系统，一般的话会有针对权限的控制，一般权限的控制就使用的是二进制：

```js
# 各个权限
permissions = {
    "SYS_SETTING" : {
        "value" : 0b10000000,
        "info" : "系统重要设置权限"
    },
    "DATA_ADMIN" : {
        "value" : 0b01000000,
        "info" : "数据库管理权限"
    },
    "USER_MANG" : {
        "value" : 0b00100000,
        "info" : "用户管理权限"
    },
    "POST_EDIT" : {
        "value" : 0b00010000,
        "info" : "文章编辑操作权限"
    },
    "POST_VIEW" : {
        "value" : 0b00001000,
        "info" : "文章查看权限"
    }
}
```

再例如，在 linux 操作系统里面，x 代表可执行权限，w代表可写权限，r 代表可读权限，对应的权限值分别就是1、2、4（2 的幂次方）

使用二进制来表示权限，首先速度上面会更快一些，其次在表示多种权限的时候，会更加方便一些。

比如，现在有 3 个权限 A、B、C...

根据不同的权限做不同的事情：

```js
if(value === A){
  // ...
} else if(value === B){
  // ...
}
```

在上面的代码中，会有一个问题，目前仅仅只是一对一的关系，但是在实际开发中，往往有很多一对多的关系，一个 value 可能会对应好几个值。

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-01-03-055329.png" alt="image-20230103135329257" style="zoom: 33%;" />

复习一下和二进制相关的运算：

- 与（ & ）：只要有一位数为 0，那么最终结果就是 0，也就是说，必须两位都是 1，最终结果才是 1
- 或（ | ）: 只要有一位数是 1，那么最终结果就是 1，也就是说必须两个都是 0，最终才是 0
- 非 （ ~ ）: 对一个二进制数逐位取反，也就是说 0、1 互换
- 异或（ ^ ）: 如果两个二进制位不相同，那么结果就为 1，相同就为 0

```js
1 & 1 = 1

0000 0001
0000 0001
---------
0000 0001

1 & 0 = 0

0000 0001
0000 0000
---------
0000 0000

1 | 0 = 1

0000 0001
0000 0000
---------
0000 0001

1 ^ 0 = 1

0000 0001
0000 0000
---------
0000 0001

~3
0000 0011
// 逐位取反
1111 1100
// 计算结果最终为 -4（涉及到补码的知识）
```

接下来我们来看一下位运算在权限系统里面的实际运用：

| 下载 | 打印 | 查看 | 审核 | 详细 | 删除 | 编辑 | 创建 |
| :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
|  0   |  0   |  0   |  0   |  0   |  0   |  0   |  0   |

如果是 0，代表没有权限，如果是 1，代表有权限

0000 0001 代表只有创建的权限，0010 0011 代表有查看、编辑以及创建的权限



**添加权限**

直接使用或运算即可。

0000 0011 目前有创建和编辑的权限，我们要给他添加一个查看的权限 0010 0000

```js
0000 0011
0010 0000
---------
0010 0011
```



**删除权限**

可以使用异或

0010 0011 目前有查看、编辑和创建，取消编辑的权限 0000 0010

```js
0010 0011
0000 0010
---------
0010 0001
```



**判断是否有某一个权限**

可以使用与来进行判断

0011 1100（查看、审核、详细、删除），判断是否有查看（0010 0000）权限、再判断是否有创建（0000 0001）权限

```js
0011 1100
0010 0000
---------
0010 0000

// 判断是否有“查看”权限，做与操作时得到了“查看”权限值本身，说明有这个权限
```

```js
0011 1100
0000 0001
---------
0000 0000

// 最终得到的值为 0，说明没有此权限
```



通过上面的例子，我们会发现使用位运算确确实实非常的方便，接下来我们就来看一下 React 中针对位运算的使用。



## React 中的位运算

- fiber 的 flags
- lane 模型
- 上下文



**fiber 的 flags**

在 React 中，用来标记 fiber 操作的 flags，使用的就是二进制：

```js
export const NoFlags = /*                      */ 0b000000000000000000000000000;
export const PerformedWork = /*                */ 0b000000000000000000000000001;
export const Placement = /*                    */ 0b000000000000000000000000010;
export const DidCapture = /*                   */ 0b000000000000000000010000000;
export const Hydrating = /*                    */ 0b000000000000001000000000000;
// ...
```

这些 flags 就是用来标记 fiber 状态的。

之所以要专门抽离 fiber 的状态，是因为这种操作是非常高效的。针对一个 fiber 的操作，可能有增加、删除、修改，但是我不直接进行操作，而是给这个 fiber 打上一个 flag，接下来在后面的流程中针对有 flag 的 fiber 统一进行操作。

通过位运算，就可以很好的解决一个 fiber 有多个 flag 标记的问题，方便合并多个状态

```js
// 初始化一些 flags
const NoFlags = 0b00000000000000000000000000;
const PerformedWork =0b00000000000000000000000001;
const Placement =  0b00000000000000000000000010;
const Update = 0b00000000000000000000000100;

// 一开始将 flag 变量初始化为没有 flag，也就是 NoFlags
let flag = NoFlags

// 这里就是在合并多个状态
flag = flag | PerformedWork | Update

// 要判断是否有某一个 flag，直接通过 & 来进行判断即可
//判断是否有  PerformedWork 种类的更新
if(flag & PerformedWork){
    //执行
    console.log('执行 PerformedWork')
}

//判断是否有 Update 种类的更新
if(flag & Update){
    //执行
    console.log('执行 Update')
}


if(flag & Placement){
    //不执行
    console.log('执行 Placement')
}
```



**lane 模型**

lane 模型也是一套优先级机制，相比 Scheduler，lane 模型能够对任务进行更细粒度的控制。

```js
export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000100;
// ...
```

例如在 React 源码中，有一段如下的代码：

```js
// lanes 一套 lane 的组合
function getHighestPriorityLanes(lanes) {
  // 从 lanes 这一套组合中，分离出优先级最高的 lane
  switch (getHighestPriorityLane(lanes)) {
    case SyncLane:
      return SyncLane;
    case InputContinuousHydrationLane:
      return InputContinuousHydrationLane;
    case InputContinuousLane:
      return InputContinuousLane;
      // ...
      return lanes;
  }
}

// lane 在表示优先级的时候，大致是这样的：
// 0000 0001
// 0000 0010
// 0010 0000
// lanes 表示一套 lane 的组合，比如上面的三个 lane 组合到一起就变成了一个 lanes 0010 0011
// getHighestPriorityLane 这个方法要做的事情就是分离出优先级最高的
// 0010 0011 ----> getHighestPriorityLane -----> 0000 0001

export function getHighestPriorityLane(lanes) {
  return lanes & -lanes;
}
```

假设现在我们针对两个 lane 进行合并

```js
const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;
const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000100;
```

合并出来就是一个 lanes，合并出来的结果如下：

```js
0b0000000000000000000000000000001
0b0000000000000000000000000000100
---------------------------------
0b0000000000000000000000000000101
```

0b0000000000000000000000000000101 是我们的 lanes，接下来取负值

```js
-lanes = 0b1111111111111111111111111111011
```

最后一步，再和本身的 lanes 做一个 & 操作：

```js
0b0000000000000000000000000000101
0b1111111111111111111111111111011
---------------------------------
0b0000000000000000000000000000001
```

经过 & 操作之后，就把优先级最高的 lane 给分离出来了。



**上下文**

在 React 源码内部，有多个上下文：

```js
// 未处于 React 上下文
export const NoContext = /*             */ 0b000;
// 处于 batchedUpdates 上下文
const BatchedContext = /*               */ 0b001;
// 处于 render 阶段
export const RenderContext = /*         */ 0b010;
// 处于 commit 阶段
export const CommitContext = /*         */ 0b100;
```

当执行流程到了 render 阶段，那么接下来就会切换上下文，切换到 RenderContext

```js
let executionContext = NoContext; // 一开始初始化为没有上下文
executionContext |= RenderContext;
```

在执行方法的时候，就会有一个判断，判断当前处于哪一个上下文

```js
// 是否处于 RenderContext 上下文中，结果为 true
(executionContext & RenderContext) !== NoContext

// 是否处于 CommitContext 上下文中，结果为 false
(executionContext & CommitContext) !== NoContext
```

如果要离开某一个上下文

```js
// 从当前上下文中移除 RenderContext 上下文
executionContext &= ~RenderContext;
// 是否处于 RenderContext 上下文中，结果为 false
(executionContext & CommitContext) !== NoContext
```



## 总结

> 题目：React 中哪些地方用到了位运算？
>
> 参考答案：
>
> 位运算可以很方便的表达“增、删、改、查”。在 React 内部，像 flags、状态、优先级等操作都大量使用到了位运算。
>
> 细分下来主要有如下的三个地方：
>
> - fiber 的 flags
> - lane 模型
> - 上下文

# 图解 diff 算法

> 思考：React 为什么不采用 Vue 的双端对比算法？

Render 阶段会生成 Fiber Tree，所谓的 diff 实际上就是发生在这个阶段，这里的 diff **指的是 current FiberNode 和 JSX 对象之间进行对比，然后生成新的的 wip FiberNode。**

> 除了 React 以外，其他使用到了虚拟 DOM 的前端框架也会有类似的流程，比如 Vue 里面将这个流程称之为 patch。

diff 算法本身是有性能上面的消耗，在 React 文档中有提到，即便采用最前沿的算法，如果要完整的对比两棵树，那么算法的复杂度都会达到 O(n^3)，n 代表的是元素的数量，如果 n 为 1000，要执行的计算量会达到十亿量级的级别。

因此，为了降低算法的复杂度，React 为 diff 算法设置了 3 个限制：

- 限制一：只对同级别元素进行 diff，如果一个 DOM 元素在前后两次更新中跨越了层级，那么 React 不会尝试复用它
- 限制二：两个不同类型的元素会产生不同的树。比如元素从 div 变成了 p，那么 React 会直接销毁 div 以及子孙元素，新建 p 以及 p 对应的子孙元素
- 限制三：开发者可以通过 key 来暗示哪些子元素能够保持稳定

更新前：

```jsx
<div>
  <p key="one">one</p>
  <h3 key="two">two</h3>
</div>
```

更新后

```jsx
<div>
  <h3 key="two">two</h3>
  <p key="one">one</p>
</div>
```

如果没有 key，那么 React 就会认为 div 的第一个子元素从 p 变成了 h3，第二个子元素从 h3 变成了 p，因此 React 就会采用限制二的规则。

但是如果使用了 key，那么此时的 DOM 元素是可以复用的，只不过前后交换了位置而已。



接下来我们回头再来看限制一，对同级元素进行 diff，究竟是如何进行 diff ？整个 diff 的流程可以分为两大类：

- 更新后只有一个元素，此时就会根据 newChild 创建对应的 wip FiberNode，对应的流程就是单节点 diff
- 更新后有多个元素，此时就会遍历 newChild 创建对应的 wip FiberNode 已经它的兄弟元素，此时对应的流程就是多节点 diff



## 单节点 diff

单节点指的是新节点为单一节点，但是旧节点的数量是不一定

单节点 diff 是否能够复用遵循以下的流程：

- 判断 key 是否相同
  - 如果更新前后没有设置 key，那么 key 就是 null，也是属于相同的情况
  - 如果 key 相同，那么就会进入到步骤二
  - 如果 key 不同，就不需要进入步骤，无需判断 type，结果直接为不能复用（如果有兄弟节点还会去遍历兄弟节点）
- 如果 key 相同，再判断 type 是否相同
  - 如果 type 相同，那么就复用
  - 如果 type 不同，无法复用（并且兄弟节点也一并标记为删除）

更新前

```jsx
<ul>
  <li>1</li>
  <li>2</li>
  <li>3</li>
</ul>
```

更新后

```jsx
<ul>
  <p>1</p>
</ul>
```

这里因为没有设置 key，所以会被设为 key 是相同的，接下来就会进入到 type 的判断，此时发现 type 不同，因此不能够复用。

既然这里唯一的可能性都已经不能够复用，会直接标记兄弟 FiberNode 为删除状态。

> 如果上面的例子中，key 不同只能代表当前的 FiberNode 无法复用，因此还需要去遍历兄弟的 FiberNode

下面我们再来看一些示例

更新前

```jsx
<div>one</div>
```

更新后

```jsx
<p>one</p>
```

没有设置 key，那么可以认为默认 key 就是 null，更新前后两个 key 是相同的，接下来就查看 type，发现 type 不同，因此不能复用。



更新前

```jsx
<div key="one">one</div>
```

更新后

```jsx
<div key="two">one</div>
```

更新前后 key 不同，不需要再判断 type，结果为不能复用



更新前

```jsx
<div key="one">one</div>
```

更新后

```jsx
<p key="two">one</p>
```

更新前后 key 不同，不需要再判断 type，结果为不能复用



更新前

```jsx
<div key="one">one</div>
```

更新后

```jsx
<div key="one">two</div>
```

首先判断 key 相同，接下来判断 type 发现也是相同，这个 FiberNode 就能够复用，children 是一个文本节点，之后将文本节点更新即可。



## 多节点 diff

所谓多节点 diff，指的是新节点有多个。

React 团队发现，在日常开发中，对节点的更新操作的情况往往要多余对节点“新增、删除、移动”，因此在进行多节点 diff 的时候，React 会进行两轮遍历：

- 第一轮遍历会尝试逐个的复用节点
- 第二轮遍历处理上一轮遍历中没有处理完的节点



### 第一轮遍历

第一轮遍历会从前往后依次进行遍历，存在三种情况：

- 如果新旧子节点的key 和 type 都相同，说明可以复用
- 如果新旧子节点的 key 相同，但是 type 不相同，这个时候就会根据 ReactElement 来生成一个全新的 fiber，旧的 fiber 被放入到 deletions 数组里面，回头统一删除。但是注意，此时遍历并不会终止
- 如果新旧子节点的 key 和 type 都不相同，结束遍历



**示例一**

更新前

```jsx
<div>
	<div key="a">a</div>
  <div key="b">b</div>
  <div key="c">c</div>
  <div key="d">d</div>
</div>
```

更新后

```jsx
<div>
	<div key="a">a</div>
  <div key="b">b</div>
  <div key="e">e</div>
  <div key="d">d</div>
</div>
```

首先遍历到 div.key.a，发现该 FiberNode 能够复用

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-032654.png" alt="image-20230228112653938" style="zoom:50%;" />

继续往后面走，发现 div.key.b 也能够复用

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-075146.png" alt="image-20230228155145634" style="zoom:50%;" />

接下来继续往后面走，div.key.e，这个时候发现 key 不一样，因此第一轮遍历就结束了

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-075345.png" alt="image-20230228155345381" style="zoom:50%;" />



**示例二**

更新前

```jsx
<div>
	<div key="a">a</div>
  <div key="b">b</div>
  <div key="c">c</div>
  <div key="d">d</div>
</div>
```

更新后

```jsx
<div>
	<div key="a">a</div>
  <div key="b">b</div>
  <p key="c">c</p>
  <div key="d">d</div>
</div>
```

首先和上面的一样，div.key.a 和 div.key.b 这两个 FiberNode 可以进行复用，接下来到了第三个节点，此时会发现 key 是相同的，但是 type 不相同，此时就会将对应的旧的 FiberNode 放入到一个叫 deletions 的数组里面，回头统一进行删除，根据新的 React 元素创建一个新的 FiberNode，但是此时的遍历是不会结束的

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-075011.png" alt="image-20230228155011306" style="zoom:50%;" />

接下来继续往后面进行遍历，遍历什么时候结束呢？

- 到末尾了，也就是说整个遍历完了
- 或者是和示例一相同，可以 key 不同

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-075725.png" alt="image-20230228155725123" style="zoom:50%;" />



### 第二轮遍历

如果第一轮遍历被提前终止了，那么意味着有新的 React 元素或者旧的 FiberNode 没有遍历完，此时就会采用第二轮遍历

第二轮遍历会处理这么三种情况：

- 只剩下旧子节点：将旧的子节点添加到 deletions 数组里面直接删除掉（删除的情况）

- 只剩下新的 JSX 元素：根据 ReactElement 元素来创建 FiberNode 节点（新增的情况）

- 新旧子节点都有剩余：会将剩余的 FiberNode 节点放入一个 map 里面，遍历剩余的新的 JSX 元素，然后从 map 中去寻找能够复用的 FiberNode 节点，如果能够找到，就拿来复用。（移动的情况）

  如果不能找到，就新增呗。然后如果剩余的 JSX 元素都遍历完了，map 结构中还有剩余的 Fiber 节点，就将这些 Fiber 节点添加到 deletions 数组里面，之后统一做删除操作



**只剩下旧子节点**

更新前

```jsx
<div>
  <div key="a">a</div>
  <div key="b">b</div>
  <div key="c">c</div>
  <div key="d">d</div>
</div>
```

更新后

```jsx
<div>
  <div key="a">a</div>
  <div key="b">b</div>
</div>
```

遍历前面两个节点，发现能够复用，此时就会复用前面的节点，对于 React 元素来讲，遍历完前面两个就已经遍历结束了，因此剩下的FiberNode就会被放入到 deletions 数组里面，之后统一进行删除

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-080358.png" alt="image-20230228160357510" style="zoom:50%;" />



**只剩下新的 JSX 元素**

更新前

```jsx
<div>
  <div key="a">a</div>
  <div key="b">b</div>
</div>
```

更新后

```jsx
<div>
  <div key="a">a</div>
  <div key="b">b</div>
  <div key="c">c</div>
  <div key="d">d</div>
</div>
```

根据新的 React 元素新增对应的 FiberNode 即可。

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-080558.png" alt="image-20230228160557549" style="zoom:50%;" />



**新旧子节点都有剩余**

更新前

```jsx
<div>
  <div key="a">a</div>
  <div key="b">b</div>
  <div key="c">c</div>
  <div key="d">d</div>
</div>
```

更新后

```jsx
<div>
  <div key="a">a</div>
  <div key="c">b</div>
  <div key="b">b</div>
  <div key="e">e</div>
</div>
```

首先会将剩余的旧的 FiberNode 放入到一个 map 里面

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-081414.png" alt="image-20230228161414334" style="zoom:50%;" />

接下来会继续去遍历剩下的 JSX 对象数组，遍历的同时，从 map 里面去找有没有能够复用

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-081859.png" alt="image-20230228161859070" style="zoom:50%;" />

如果在 map 里面没有找到，那就会新增这个 FiberNode，如果整个 JSX 对象数组遍历完成后，map 里面还有剩余的 FiberNode，说明这些 FiberNode 是无法进行复用，直接放入到 deletions 数组里面，后期统一进行删除。

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-082152.png" alt="image-20230228162152734" style="zoom:50%;" />



## 双端对比算法

所谓双端，指的是在新旧子节点的数组中，各用两个指针指向头尾的节点，在遍历的过程中，头尾两个指针同时向中间靠拢。

因此在新子节点数组中，会有两个指针，newStartIndex 和 newEndIndex 分别指向新子节点数组的头和尾。在旧子节点数组中，也会有两个指针，oldStartIndex 和 oldEndIndex 分别指向旧子节点数组的头和尾。

<img src="https://xiejie-typora.oss-cn-chengdu.aliyuncs.com/2023-02-28-085007.png" alt="image-20230228165007200" style="zoom:50%;" />

每遍历到一个节点，就尝试进行双端比较：「新前 vs 旧前」、「新后 vs 旧后」、「新后 vs 旧前」、「新前 vs 旧后」，如果匹配成功，更新双端的指针。比如，新旧子节点通过「新前 vs 旧后」匹配成功，那么 newStartIndex += 1，oldEndIndex -= 1。

如果新旧子节点通过「新后 vs 旧前」匹配成功，还需要将「旧前」对应的 DOM 节点插入到「旧后」对应的 DOM 节点之前。如果新旧子节点通过「新前 vs 旧后」匹配成功，还需要将「旧后」对应的 DOM 节点插入到「旧前」对应的 DOM 节点之前。



实际上在 React 的源码中，解释了为什么不使用双端 diff

```js
function reconcileChildrenArray(
returnFiber: Fiber,
 currentFirstChild: Fiber | null,
 newChildren: Array<*>,
 expirationTime: ExpirationTime,
): Fiber | null {
    // This algorithm can't optimize by searching from boths ends since we
    // don't have backpointers on fibers. I'm trying to see how far we can get
    // with that model. If it ends up not being worth the tradeoffs, we can
    // add it later.

    // Even with a two ended optimization, we'd want to optimize for the case
    // where there are few changes and brute force the comparison instead of
    // going for the Map. It'd like to explore hitting that path first in
    // forward-only mode and only go for the Map once we notice that we need
    // lots of look ahead. This doesn't handle reversal as well as two ended
    // search but that's unusual. Besides, for the two ended optimization to
    // work on Iterables, we'd need to copy the whole set.

    // In this first iteration, we'll just live with hitting the bad case
    // (adding everything to a Map) in for every insert/move.

    // If you change this code, also update reconcileChildrenIterator() which
    // uses the same algorithm.
｝
```

将上面的注视翻译成中文如下：

>由于双端 diff 需要向前查找节点，但每个 FiberNode 节点上都没有反向指针，即前一个 FiberNode 通过 sibling 属性指向后一个 FiberNode，只能从前往后遍历，而不能反过来，因此该算法无法通过双端搜索来进行优化。
>
>React 想看下现在用这种方式能走多远，如果这种方式不理想，以后再考虑实现双端 diff。React 认为对于列表反转和需要进行双端搜索的场景是少见的，所以在这一版的实现中，先不对 bad case 做额外的优化。



## 总结

> 题目：React 中的 diff 算法有没有了解过？具体的流程是怎么样的？React 为什么不采用 Vue 的双端对比算法？
>
> 参考答案：
>
> diff 计算发生在更新阶段，当第一次渲染完成后，就会产生 Fiber 树，再次渲染的时候（更新），就会拿新的 JSX 对象（vdom）和旧的 FiberNode 节点进行一个对比，再决定如何来产生新的 FiberNode，它的目标是尽可能的复用已有的 Fiber 节点。这个就是 diff 算法。
>
> 在 React 中整个 diff 分为单节点 diff 和多节点 diff。
>
> 所谓单节点是指新的节点为单一节点，但是旧节点的数量是不一定的。
>
> 单节点 diff 是否能够复用遵循如下的顺序：
>
> 1. 判断 key 是否相同
>
>    - 如果更新前后均未设置 key，则 key 均为 null，也属于相同的情况
>
>    - 如果 key 相同，进入步骤二
>    - 如果 key 不同，则无需判断 type，结果为不能复用（有兄弟节点还会去遍历兄弟节点）
>
> 2. 如果 key 相同，再判断 type 是否相同
>
>    - 如果 type 相同，那么就复用
>    - 如果 type 不同，则无法复用（并且兄弟节点也一并标记为删除）
>
> 多节点 diff 会分为两轮遍历：
>
> 第一轮遍历会从前往后进行遍历，存在以下三种情况：
>
> - 如果新旧子节点的key 和 type 都相同，说明可以复用
> - 如果新旧子节点的 key 相同，但是 type 不相同，这个时候就会根据 ReactElement 来生成一个全新的 fiber，旧的 fiber 被放入到 deletions 数组里面，回头统一删除。但是注意，此时遍历并不会终止
> - 如果新旧子节点的 key 和 type 都不相同，结束遍历
>
> 如果第一轮遍历被提前终止了，那么意味着还有新的 JSX 元素或者旧的 FiberNode 没有被遍历，因此会采用第二轮遍历去处理。
>
> 第二轮遍历会遇到三种情况：
>
> - 只剩下旧子节点：将旧的子节点添加到 deletions 数组里面直接删除掉（删除的情况）
>
> - 只剩下新的 JSX 元素：根据 ReactElement 元素来创建 FiberNode 节点（新增的情况）
>
> - 新旧子节点都有剩余：会将剩余的 FiberNode 节点放入一个 map 里面，遍历剩余的新的 JSX 元素，然后从 map 中去寻找能够复用的 FiberNode 节点，如果能够找到，就拿来复用。（移动的情况）
>
>   如果不能找到，就新增呗。然后如果剩余的 JSX 元素都遍历完了，map 结构中还有剩余的 Fiber 节点，就将这些 Fiber 节点添加到 deletions 数组里面，之后统一做删除操作
>
> 整个 diff 算法最最核心的就是两个字“复用”。
>
> React 不使用双端 diff 的原因：
>
> 由于双端 diff 需要向前查找节点，但每个 FiberNode 节点上都没有反向指针，即前一个 FiberNode 通过 sibling 属性指向后一个 FiberNode，只能从前往后遍历，而不能反过来，因此该算法无法通过双端搜索来进行优化。
>
> React 想看下现在用这种方式能走多远，如果这种方式不理想，以后再考虑实现双端 diff。React 认为对于列表反转和需要进行双端搜索的场景是少见的，所以在这一版的实现中，先不对 bad case 做额外的优化。



# 「❤️ 感谢大家」

如果你觉得这篇内容对你挺有有帮助的话：

点赞支持下吧，让更多的人也能看到这篇内容（收藏不点赞，都是耍流氓 -_-）欢迎在留言区与我分享你的想法，也欢迎你在留言区记录你的思考过程。觉得不错的话，也可以阅读Sunny近期梳理的文章（感谢掘友的鼓励与支持🌹🌹🌹）：

**热门文章**

- [✨ 爆肝10w字，带你精通 React18 架构设计和源码实现【上】]()
- [✨ 爆肝10w字，带你精通 React18 架构设计和源码实现【下】]()
- [前端包管理进阶：通用函数库与组件库打包实战](https://juejin.cn/post/7376827589909266458)
- [🍻 前端服务监控原理与手写开源监控框架SDK](https://juejin.cn/post/7374265502669160482)
- [🚀 2w字带你精通前端脚手架开源工具开发](https://juejin.cn/post/7363607004348989479)
- [🔥 爆肝5w字，带你深入前端构建工具 Rollup 高阶使用、API、插件机制和开发](https://juejin.cn/post/7363607004348923943)

**专栏**

- [精通现代前端工具链及生态](https://juejin.cn/column/7287224080172302336)
- [esbuild 原理与应用实战](https://juejin.cn/column/7285233095058718756)
- [js-challanges 题解来了，迎接你的校招提前批](https://juejin.cn/column/7244788137410560055)

