import  React from 'react';
import ReactDOM from 'react-dom';
let memoizedState;
function useState(initialState){
  memoizedState = memoizedState || initialState;
  function setState(newState){
     memoizedState = newState;
     render();
  }
  return [memoizedState,setState];
}
function Counter(){
    //useState就是一个hooks
    //第一个是当前的状态，第二个是改变状态的函数
    //核心作用是给函数组件增加了一个保持状态的功能
    const [number,setNumber] = useState(0);//参数是初始状态
    return (
        <>
            <p>{number}</p>
            <button onClick={()=>setNumber(number+1)}>+</button>
        </>
    )
}
function render(){
    ReactDOM.render(<Counter/>,document.getElementById('root'));
}
render();