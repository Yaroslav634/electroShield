// compatibility.js

const compatibilityRules = [
  {
    check: (comp) => {
      const automats = selectedComponents.filter(c => c.category_name?.includes("Автоматические выключатели"));
      const uzo = selectedComponents.filter(c => c.category_name?.includes("Устройства защитного отключения"));
      if (automats.length && uzo.length) {
        const maxAutomatAmps = Math.max(...automats.map(c => parseInt(c.power_rating) || 0));
        const minUzoAmps = Math.min(...uzo.map(c => parseInt(c.power_rating) || 0));
        if (maxAutomatAmps > minUzoAmps) {
          return {
            type: "warning",
            message: `Автомат на ${maxAutomatAmps}А превышает номинал УЗО на ${minUzoAmps}А. Рекомендуется согласовать номиналы.`
          };
        }
      }
      return null;
    }
  },
  {
    check: (comp) => {
      const voltages = [...new Set(selectedComponents.map(c => c.voltage).filter(Boolean))];
      if (voltages.length > 1) {
        return {
          type: "error",
          message: `Обнаружены компоненты с разным напряжением: ${voltages.join(", ")}. Проверьте совместимость.`
        };
      }
      return null;
    }
  }
];

// compatibility.js

function checkCompatibility() {
  if (typeof selectedComponents === 'undefined' || !selectedComponents) return [];
  
  const issues = [];
  
  const voltages = [...new Set(selectedComponents.map(c => c.voltage).filter(Boolean))];
  if (voltages.length > 1) {
    issues.push({
      type: "error",
      message: `Обнаружены компоненты с разным напряжением: ${voltages.join(", ")}. Проверьте совместимость.`
    });
  }
  
  return issues;
}

function showCompatibilityWarnings() {
  const issues = checkCompatibility();
  const container = document.getElementById("compatibilityWarnings");
  if (!container) return;
  
  if (issues.length === 0) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }
  
  container.style.display = "block";
  container.innerHTML = issues.map(i => `
    <div style="padding: 10px 14px; margin-bottom: 8px; border-radius: 8px; display: flex; align-items: center; gap: 10px; font-size: 0.9rem;
      background: ${i.type === 'error' ? 'var(--danger-light)' : 'var(--warning-light)'};
      color: ${i.type === 'error' ? 'var(--danger-color)' : 'var(--warning-color)'};
      border-left: 4px solid ${i.type === 'error' ? 'var(--danger-color)' : 'var(--warning-color)'};">
      <i class="fas fa-${i.type === 'error' ? 'exclamation-circle' : 'exclamation-triangle'}"></i>
      ${i.message}
    </div>
  `).join("");
}

window.showCompatibilityWarnings = showCompatibilityWarnings;