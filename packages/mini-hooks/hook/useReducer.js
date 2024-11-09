import  React from 'react';
import ReactDOM from 'react-dom';

let initalArg = 0;
const INCREMENT = 'INCREMENT';
const DECREMENT = 'DECREMENT';
function reducer(state,action){
  switch(action.type){
      case INCREMENT:
         return {number:state.number+1};
      case DECREMENT:
         return {number:state.number-1};   
      default:
         return state;   
  }
}
function init(initalArg){
  return {number:initalArg};
}
/**
1.useReducer是useState 的内部实现
2.比如说改变状态逻辑复杂 的时候，或者 下一个状态依赖前一个状态的时候可以使用useReducer
suspence 实现异步操作
*/
let memoizedState;
function useReducer(reducer,initalArg,init){
   let initialState = void 0;
   if(typeof init  != 'undefined'){
      initialState = init(initalArg);
   }else{
       initialState = initalArg;
   }
   function dispatch(action){
       memoizedState = reducer(memoizedState,action);
       render();
   }
   memoizedState = memoizedState||initialState;
   return [memoizedState,dispatch];
}

function Counter(){
    let [state,dispatch] = useReducer(reducer,initalArg,init);
    return (
        <>
            <p>{state.number}</p>
            <button onClick={()=>dispatch({type:INCREMENT})}>+</button>
            <button onClick={()=>dispatch({type:DECREMENT})}>-</button>
        </>
    )
}
function render(){
    ReactDOM.render(<Counter/>,document.getElementById('root'));
}
render();