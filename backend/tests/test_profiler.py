import json

import pytest

from backend.app.analysis.profiler import profile_dataframe
from backend.app.ingestion.loader import parse_csv


def test_french_excel_export_is_parsed():
    content = "nom;montant\nCafé;10,5\nThé;3,2\n".encode("cp1252")

    dataframe = parse_csv(content)

    assert list(dataframe.columns) == ["nom", "montant"]
    assert dataframe["montant"].tolist() == [10.5, 3.2]
    assert dataframe["nom"].tolist() == ["Café", "Thé"]


def test_utf8_bom_and_tab_separator_are_handled():
    dataframe = parse_csv("﻿a\tb\n1\t2\n".encode("utf-8"))

    assert list(dataframe.columns) == ["a", "b"]


@pytest.mark.parametrize("content", [b"", b"  \n"])
def test_empty_file_is_rejected(content):
    with pytest.raises(ValueError, match="vide"):
        parse_csv(content)


def test_single_row_profile_is_json_compliant():
    analysis = profile_dataframe(parse_csv(b"x,y\n1,2\n"))

    json.dumps(analysis, allow_nan=False)
    assert analysis["statistics"]["x"]["std"] is None


def test_infinite_values_are_ignored():
    analysis = profile_dataframe(parse_csv(b"x,y\n1,inf\n2,3\n4,5\n"))

    json.dumps(analysis, allow_nan=False)
    assert analysis["statistics"]["y"]["max"] == 5.0


def test_profile_counts_missing_duplicates_and_outliers():
    analysis = profile_dataframe(parse_csv(b"v,c\n1,a\n1,a\n2,\n3,b\n100,b\n"))

    assert analysis["overview"]["duplicates"] == 1
    assert analysis["missing_values"] == {"v": 0, "c": 1}
    assert analysis["outliers"]["v"]["count"] == 1
    assert analysis["columns"][1]["missing_percentage"] == 20.0
