import  React from 'react';
import ReactDOM from 'react-dom';

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
function useState(initialState){
   return useReducer((oldState,newState)=>newState,initialState);
}
function Counter(){
    //useState就是一个hooks
    //第一个是当前的状态，第二个是改变状态的函数
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