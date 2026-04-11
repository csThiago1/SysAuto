import { Redirect } from 'expo-router';

// Tab raiz redireciona para a lista de OS
export default function AppIndex() {
  return <Redirect href="/(app)/os" />;
}
