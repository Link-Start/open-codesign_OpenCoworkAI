function _App(){throw new Error('Wrong entry mounted');}
function App(){const [value,setValue]=React.useState('App selected');return <input aria-label="ABI value" value={value} onChange={e=>setValue(e.target.value)}/>}
