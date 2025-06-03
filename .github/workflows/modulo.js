// Funções auxiliares para o Tarot
const moduloTarot = {
    // Função para embaralhar as cartas
    embaralharCartas: function(cartas) {
        return [...cartas].sort(() => Math.random() - 0.5);
    },

    // Função para calcular compatibilidade entre cartas
    calcularCompatibilidade: function(carta1, carta2) {
        const elementos = {
            'Fogo': ['Terra', 'Ar'],
            'Terra': ['Fogo', 'Água'],
            'Ar': ['Fogo', 'Água'],
            'Água': ['Terra', 'Ar']
        };

        return elementos[carta1.element]?.includes(carta2.element) ? 'Alta' : 'Baixa';
    },

    // Função para interpretar combinações de elementos
    interpretarElementos: function(elementos) {
        const interpretacoes = {
            'Fogo_Terra': 'Energia criativa manifestada em resultados práticos',
            'Fogo_Ar': 'Inspiração transformada em ação',
            'Terra_Água': 'Estabilidade emocional e material',
            'Ar_Água': 'Comunicação clara e intuitiva'
        };

        const chave = elementos.sort().join('_');
        return interpretacoes[chave] || 'Combinação única que requer análise individual';
    },

    // Função para gerar relatório de leitura
    gerarRelatorio: function(cartas) {
        const elementos = cartas.map(c => c.element);
        const elementosUnicos = [...new Set(elementos)];
        
        return {
            totalCartas: cartas.length,
            elementosPresentes: elementosUnicos,
            dominancia: this.calcularDominanciaElemental(elementos),
            interpretacao: this.interpretarElementos(elementosUnicos)
        };
    },

    // Função para calcular dominância elemental
    calcularDominanciaElemental: function(elementos) {
        const contagem = {};
        elementos.forEach(el => contagem[el] = (contagem[el] || 0) + 1);
        
        return Object.entries(contagem)
            .sort((a, b) => b[1] - a[1])
            .map(([elemento, quantidade]) => ({
                elemento,
                quantidade,
                porcentagem: (quantidade / elementos.length * 100).toFixed(1)
            }));
    },

    // Função para validar leitura
    validarLeitura: function(cartas) {
        const regras = {
            maxCartas: 10,
            minCartas: 1,
            elementosPermitidos: ['Fogo', 'Terra', 'Ar', 'Água']
        };

        if (cartas.length > regras.maxCartas) {
            return {
                valido: false,
                mensagem: `Máximo de ${regras.maxCartas} cartas excedido`
            };
        }

        if (cartas.length < regras.minCartas) {
            return {
                valido: false,
                mensagem: `Mínimo de ${regras.minCartas} carta(s) necessário`
            };
        }

        const elementosInvalidos = cartas.filter(c => !regras.elementosPermitidos.includes(c.element));
        if (elementosInvalidos.length > 0) {
            return {
                valido: false,
                mensagem: 'Elementos inválidos encontrados'
            };
        }

        return {
            valido: true,
            mensagem: 'Leitura válida'
        };
    }
};

// Exportando o módulo
export default moduloTarot;