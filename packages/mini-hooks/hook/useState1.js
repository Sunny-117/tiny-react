import  React from 'react';
import ReactDOM from 'react-dom';
let memoizedStates=[];
let index = 0;
function useState(initialState){
  memoizedStates[index] = memoizedStates[index] || initialState;
  let currentIndex = index;
  function setState(newState){
     memoizedStates[currentIndex] = newState;
     render();
  }
  return [memoizedStates[index++],setState];
}
function Counter(){
    /**
    第一轮的时候memoizedStates=['计数器',0]
    第二轮的时候memoizedStates=['计数器',1]
     */
    const [name,setName] = useState('计数器');
    const [number,setNumber] = useState(0);
    return (
        <>
            <p>{name}:{number}</p>
            <button onClick={()=>setName('计数器'+Date.now())}>改名称</button>
            <button onClick={()=>setNumber(number+1)}>+</button>
        </>
    )
}
function render(){
    index = 0;
    ReactDOM.render(<Counter/>,document.getElementById('root'));
}
render();