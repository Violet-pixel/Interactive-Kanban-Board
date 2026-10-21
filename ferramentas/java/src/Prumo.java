import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

public final class Prumo {

    record Tarefa(String titulo, String coluna, String responsavel, String prioridade, LocalDate prazo, boolean concluida) {}

    private Prumo() {}

    public static void main(String[] args) throws IOException {
        if (args.length < 2 || !List.of("resumo", "atrasadas", "responsaveis").contains(args[0])) {
            System.err.println("Uso: prumo <resumo|atrasadas|responsaveis> tarefas.csv [AAAA-MM-DD]");
            System.exit(1);
        }
        LocalDate hoje = args.length > 2 ? LocalDate.parse(args[2]) : LocalDate.now();
        List<Tarefa> tarefas = carregar(Path.of(args[1]));
        switch (args[0]) {
            case "resumo" -> resumo(tarefas, hoje);
            case "atrasadas" -> atrasadas(tarefas, hoje);
            default -> responsaveis(tarefas);
        }
    }

    static List<Tarefa> carregar(Path arquivo) throws IOException {
        String texto = Files.readString(arquivo, StandardCharsets.UTF_8).replace("﻿", "");
        List<List<String>> linhas = lerCsv(texto);
        if (linhas.isEmpty()) {
            return List.of();
        }
        List<String> cabecalho = linhas.get(0).stream().map(h -> h.trim().toLowerCase(Locale.ROOT)).toList();
        List<Tarefa> tarefas = new ArrayList<>();
        for (List<String> linha : linhas.subList(1, linhas.size())) {
            Map<String, String> campos = new LinkedHashMap<>();
            for (int i = 0; i < cabecalho.size(); i++) {
                campos.put(cabecalho.get(i), i < linha.size() ? linha.get(i) : "");
            }
            tarefas.add(new Tarefa(
                campos.getOrDefault("titulo", ""),
                campos.getOrDefault("coluna", ""),
                campos.getOrDefault("responsavel", ""),
                campos.getOrDefault("prioridade", "media"),
                data(campos.getOrDefault("prazo", "")),
                !campos.getOrDefault("concluido_em", "").isBlank()));
        }
        return tarefas;
    }

    static LocalDate data(String texto) {
        if (texto == null || texto.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(texto.substring(0, 10));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static List<List<String>> lerCsv(String texto) {
        List<List<String>> linhas = new ArrayList<>();
        List<String> linha = new ArrayList<>();
        StringBuilder campo = new StringBuilder();
        boolean aspas = false;
        for (int i = 0; i < texto.length(); i++) {
            char c = texto.charAt(i);
            if (aspas) {
                if (c == '"' && i + 1 < texto.length() && texto.charAt(i + 1) == '"') {
                    campo.append('"');
                    i++;
                } else if (c == '"') {
                    aspas = false;
                } else {
                    campo.append(c);
                }
            } else if (c == '"') {
                aspas = true;
            } else if (c == ',') {
                linha.add(campo.toString());
                campo.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < texto.length() && texto.charAt(i + 1) == '\n') {
                    i++;
                }
                linha.add(campo.toString());
                campo.setLength(0);
                if (linha.stream().anyMatch(v -> !v.isEmpty())) {
                    linhas.add(linha);
                }
                linha = new ArrayList<>();
            } else {
                campo.append(c);
            }
        }
        if (campo.length() > 0 || !linha.isEmpty()) {
            linha.add(campo.toString());
            linhas.add(linha);
        }
        return linhas;
    }

    static boolean atrasada(Tarefa t, LocalDate hoje) {
        return !t.concluida() && t.prazo() != null && t.prazo().isBefore(hoje);
    }

    static void resumo(List<Tarefa> tarefas, LocalDate hoje) {
        long concluidas = tarefas.stream().filter(Tarefa::concluida).count();
        long atrasadas = tarefas.stream().filter(t -> atrasada(t, hoje)).count();
        System.out.printf("Tarefas: %d | concluídas: %d | pendentes: %d | atrasadas: %d%n", tarefas.size(), concluidas, tarefas.size() - concluidas, atrasadas);
        Map<String, Integer> porColuna = new LinkedHashMap<>();
        tarefas.forEach(t -> porColuna.merge(t.coluna(), 1, Integer::sum));
        System.out.println("Colunas:");
        porColuna.forEach((coluna, total) -> System.out.printf("  %-22s %3d %s%n", coluna, total, "#".repeat(total)));
        Map<String, Integer> porPrioridade = new TreeMap<>();
        tarefas.stream().filter(t -> !t.concluida()).forEach(t -> porPrioridade.merge(t.prioridade(), 1, Integer::sum));
        System.out.println("Pendentes por prioridade: " + porPrioridade);
    }

    static void atrasadas(List<Tarefa> tarefas, LocalDate hoje) {
        List<Tarefa> lista = tarefas.stream().filter(t -> atrasada(t, hoje)).sorted((a, b) -> a.prazo().compareTo(b.prazo())).toList();
        if (lista.isEmpty()) {
            System.out.println("Nenhuma tarefa atrasada.");
            return;
        }
        lista.forEach(t -> System.out.printf("%s  %-40s %-16s %s%n", t.prazo(), t.titulo(), t.responsavel().isBlank() ? "(sem responsável)" : t.responsavel(), t.coluna()));
    }

    static void responsaveis(List<Tarefa> tarefas) {
        Map<String, int[]> mapa = new TreeMap<>();
        tarefas.forEach(t -> {
            int[] v = mapa.computeIfAbsent(t.responsavel().isBlank() ? "(sem responsável)" : t.responsavel(), k -> new int[2]);
            v[0]++;
            if (t.concluida()) {
                v[1]++;
            }
        });
        mapa.forEach((nome, v) -> System.out.printf("  %-22s %d/%d concluídas%n", nome, v[1], v[0]));
    }
}
