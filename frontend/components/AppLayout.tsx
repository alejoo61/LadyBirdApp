'use client';

import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import CateringOrdersList from '@/components/CateringOrdersList';
import StoreList from '@/components/StoresList';
import EquipmentList from '@/components/EquipmentList';
import FormulaManager from '@/components/FormulaManager';
import NewOrderWizard from '@/components/NewOrderWizard';
import AuditPage from '@/components/AuditPage';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

export default function AppLayout() {
  const { usuario, logout }                          = useAuth();
  const { activeTab, setActiveTab,
          showNewOrder, openNewOrder,
          closeNewOrder, stores }                    = useApp();

  if (!usuario) return null;

  return (
    <div className="flex h-screen bg-bone">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        usuario={usuario}
        onLogout={logout}
      />

      <main className="flex-1 overflow-y-auto p-10 bg-bone">
        {activeTab === 'Dashboard'   && <Dashboard usuario={usuario.usuario} />}
        {activeTab === 'Catering'    && (
          <CateringOrdersList onNewOrder={openNewOrder} />
        )}
        {activeTab === 'Formulas'    && <FormulaManager />}
        {activeTab === 'Audit'       && <AuditPage />}
        {activeTab === 'Stores'      && <StoreList />}
        {activeTab === 'Equipments'  && <EquipmentList />}
        {activeTab === 'Maintenance' && <Dashboard usuario={usuario.usuario} />}
      </main>

      {showNewOrder && (
        <NewOrderWizard
          stores={stores}
          onClose={closeNewOrder}
          onSave={() => {
            closeNewOrder();
            setActiveTab('Catering');
          }}
        />
      )}
    </div>
  );
}