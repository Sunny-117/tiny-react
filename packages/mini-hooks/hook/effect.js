import  React from 'react';
import ReactDOM from 'react-dom';
/**
1.在函数主体中，所以不能写具有副作用的逻辑，订阅，定时器修改DOM
useEffect 给函数组件添加了操作副作用的
类组件的  didmount didupate willunmount
 */
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

function useEffect(callback,dependencies){
   if(!dependencies){
       index++;
       return callback();
   }

   let lastDependencies = memoizedStates[index];
   //依赖项不是要根据state里的值判断么？为什么实现的时候只判断两次依赖项是否一样呢？存的就是值
  let changed = lastDependencies? !dependencies.every((item,index)=>item===lastDependencies[index]):true;
  if(changed){
    callback();
    memoizedStates[index] = dependencies;
  }  
  index++;
} 
 function Counter(){
    const [name,setName] = useState('计数器');//0
    const [number,setNumber] = useState(0);//1
    useEffect(()=>{
        console.log('number1:',number)//2
    },[number]);
    useEffect(()=>{
        console.log('number2:',number)//3
    },[name, number]);
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