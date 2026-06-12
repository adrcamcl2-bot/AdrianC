def sumar(a, b):
    return a + b

def restar(a, b):
    return a - b

def multiplicar(a, b):
    return a * b

def dividir(a, b):
    if b == 0:
        raise ValueError("No se puede dividir entre cero")
    return a / b

def calculadora():
    print("=== Calculadora ===")
    print("Operaciones: + suma, - resta, * multiplica, / divide, q salir")

    while True:
        entrada = input("\nIngresa la operación (ej: 3 + 5): ").strip()

        if entrada.lower() == 'q':
            print("Saliendo...")
            break

        partes = entrada.split()
        if len(partes) != 3:
            print("Formato inválido. Usa: número operador número (ej: 3 + 5)")
            continue

        try:
            a = float(partes[0])
            operador = partes[1]
            b = float(partes[2])
        except ValueError:
            print("Números inválidos.")
            continue

        try:
            if operador == '+':
                resultado = sumar(a, b)
            elif operador == '-':
                resultado = restar(a, b)
            elif operador == '*':
                resultado = multiplicar(a, b)
            elif operador == '/':
                resultado = dividir(a, b)
            else:
                print(f"Operador '{operador}' no reconocido.")
                continue

            if resultado == int(resultado):
                print(f"Resultado: {int(resultado)}")
            else:
                print(f"Resultado: {resultado:.6g}")

        except ValueError as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    calculadora()
